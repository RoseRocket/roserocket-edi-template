import * as rrAuth from '../api/rrAuth';
import { ENVIRONMENT_VARS, DEFAULT_ENVIRONMENT } from '../constants/rrconstants';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { printFuncError, printFuncWarning, printFuncLog } from '../utils/utils';

// In order to support multiple orgs, the rrAuthenticate function can be called with an orgID
// which will load a org that may differ from the default.
export function rrAuthenticateWithSubdomain(subdomain) {
    const env = ENVIRONMENT_VARS.find(env => env.SUBDOMAIN === `${subdomain}`);
    if (env !== undefined) {
        return rrAuthenticate(env.ID);
    }
    return rrAuthenticate();
}

// Generic auth function, will load org credentials from rrconstants file, if orgId is empty
// it will use the 'Default Environment ID'
export function rrAuthenticate(orgId = DEFAULT_ENVIRONMENT) {
    return new Promise((resolve, reject) => {
        const ENV = ENVIRONMENT_VARS.find(env => env.ID == orgId) || {};
        if (!ENV.CREDENTIALS) {
            reject(`Environment not configured for orgId. ${orgId}`);
        }
        const TOKEN_FILE = ENV.TOKEN_FILE;

        const dir = path.dirname(TOKEN_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.readFile(TOKEN_FILE, 'utf8', (err, data) => {
            // if file doesnt exists, the try to login
            if (err) {
                rrAuth
                    .oauth2('', {
                        ...ENV.CREDENTIALS,
                        grant_type: 'password',
                    })
                    .then(resp => {
                        const result = { ...resp.data, orgId };
                        fs.writeFile(TOKEN_FILE, JSON.stringify(result, null, 4), err => {
                            if (err) reject(err);
                            resolve(result);
                        });
                    })
                    .catch(err => reject(err));
                return;
            }

            // if file exists
            try {
                const token = JSON.parse(data);
                const claims = jwt.decode(token.access_token);

                const currentTime = new Date().getTime() / 1000;
                const anHourLater = currentTime + 3600;

                // if its expired, then try to refresh token
                if (anHourLater > claims.exp) {
                    rrAuth
                        .oauth2('', {
                            grant_type: 'refresh_token',
                            refresh_token: token.refresh_token,
                        })
                        .then((resp = {}) => {
                            const result = { ...resp.data, orgId };
                            fs.writeFile(TOKEN_FILE, JSON.stringify(result, null, 4), err => {
                                if (err) reject(err);
                                resolve(result);
                            });
                        })
                        .catch(err => () => {
                            // if refresh fail, try to login
                            rrAuth
                                .oauth2('', {
                                    grant_type: 'password',
                                    ...ENV.CREDENTIALS,
                                })
                                .then((resp = {}) => {
                                    const result = { ...resp.data, orgId };
                                    fs.writeFile(
                                        TOKEN_FILE,
                                        JSON.stringify(result, null, 4),
                                        err => {
                                            if (err) reject(err);
                                            resolve(result);
                                        }
                                    );
                                })
                                .catch(err => reject(err));
                        });
                } else {
                    resolve(token);
                }
            } catch (e) {
                reject(e);
            }
        });
    });
}
