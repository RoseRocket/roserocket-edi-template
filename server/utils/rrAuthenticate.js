import * as rrAuth from '../api/rrAuth';
const { USERNAME, PASSWORD, CLIENT_ID, CLIENT_SECRET, TOKEN_FILE } = process.env;
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';

export function rrAuthenticate() {
    return new Promise((resolve, reject) => {
        const dir = path.dirname(TOKEN_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.readFile(TOKEN_FILE, 'utf8', (err, data) => {
            // if file doesnt exists, the try to login
            if (err) {
                rrAuth
                    .oauth2('', {
                        grant_type: 'password',
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        username: USERNAME,
                        password: PASSWORD,
                    })
                    .then(resp => {
                        fs.writeFile(TOKEN_FILE, JSON.stringify(resp.data, null, 4), err => {
                            if (err) reject(err);
                            resolve(resp.data);
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
                            fs.writeFile(TOKEN_FILE, JSON.stringify(resp.data, null, 4), err => {
                                if (err) reject(err);
                                resolve(resp.data);
                            });
                        })
                        .catch(err => () => {
                            // if refresh fail, try to login
                            rrAuth
                                .oauth2('', {
                                    grant_type: 'password',
                                    client_id: CLIENT_ID,
                                    client_secret: CLIENT_SECRET,
                                    username: USERNAME,
                                    password: PASSWORD,
                                })
                                .then((resp = {}) => {
                                    fs.writeFile(
                                        TOKEN_FILE,
                                        JSON.stringify(resp.data, null, 4),
                                        err => {
                                            if (err) reject(err);
                                            resolve(resp.data);
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
