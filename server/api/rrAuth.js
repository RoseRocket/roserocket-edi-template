import { baseRequest } from './baseRequest.js';
import { format } from 'util';

const { BASE_AUTH_URL } = process.env;

export const config = {
    authHeader: 'Authorization',
    tokenType: 'Bearer',
    timeout: 10000,

    apiVersion: '',
    urls: {
        oauth2Token: '/oauth2/token',
    },
};

// Authentication for Roserocket Integration
export function oauth2(token, data) {
    let headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
    };

    if (token) {
        headers[authHeader] = `${config.tokenType} ${token}`;
    }

    return baseRequest({
        timeout: config.timeout,
        headers,
        url: BASE_AUTH_URL + format(config.urls.oauth2Token),
        data,
        method: 'post',
    });
}
