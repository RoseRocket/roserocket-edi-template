import request from 'superagent';
import Promise from 'promise';
import { printFuncError } from '../utils/utils.js';

export function baseRequest(options = {}) {
    const { url, data, method = 'get', headers, timeout, verbose } = options;

    const requestType = method.toLowerCase();
    const consoleOutput = !!verbose;

    // If request is GET then use query. For POST/PUT methods use body. For DELETE neither
    let body;
    let query;
    if (requestType === 'get') {
        query = data;
    } else if (['post', 'put'].includes(requestType)) {
        body = data;
    }

    if(consoleOutput){
        //console.log(`Executing 3rd party API: [${method.toUpperCase()}] ${url}`, query, body);
        console.log(`Executing 3rd party API: [${method.toUpperCase()}] ${url}`);
    }

    return new Promise((resolve, reject) => {
        request[method](url)
            .timeout(timeout)
            .set(headers)
            .send(body)
            .query(query)
            .end((error, response = {}) => {
                if (error) {
                    printFuncError(method,`${url} error:${error}`);
                    reject(error);
                }
                if(consoleOutput){
                    console.log(`${method} ${url} success:`, response.body);
                }

                resolve(response.body);
            });
    });
}
