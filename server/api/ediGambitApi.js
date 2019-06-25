import { baseRequest } from './baseRequest.js';
import { getInstructions } from '../utils/utils';
import { printFuncError, printFuncWarning, printFuncLog } from '../utils/utils';

const { EDI_READ_URL, EDI_WRITE_URL, EDI_ACCESS_TOKEN } = process.env;

export const config = {
    timeout: 10000,
};

// apiReadData, will post the edi file contents 'data' and related instructions 'instructions'
// and return the full json object which will be interpreted by the system
export function apiReadData(data, instructions) {
    const headerObj = {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
        'access-token': EDI_ACCESS_TOKEN,
    };
    const dataObj = {
        data,
        instructions,
    };
    return baseRequest({
        timeout: config.timeout,
        headers: headerObj,
        url: EDI_READ_URL,
        data: dataObj,
        method: 'post',
    });
}

// apiWriteData, will post the edi file contents 'data' and related instructions 'instructions'
// and return the full json object which will be interpreted by the system
export function apiWriteData(data, instructions) {
    const headerObj = {
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=utf-8',
        'access-token': EDI_ACCESS_TOKEN,
    };
    const dataObj = {
        data,
        instructions,
    };
    return baseRequest({
        timeout: config.timeout,
        headers: headerObj,
        url: EDI_WRITE_URL,
        data: dataObj,
        method: 'post',
    });
}

// generateEDI is the wrapper function that will get the appropriate instructions and send the
// request to our online EDI Library to generate the corresponding EDI File
export function generateEDI(ediType, data) {
    return new Promise((resolve, reject) => {
        const { instructions = {}, error } = getInstructions(ediType, 'out');
        if (error) {
            reject(`There was an issue loading instructions for ${ediType} generation.`);
        }
        apiWriteData(data, instructions)
            .then(function(res) {
                if (!res) {
                    reject('There was an issue communicating with the EDI library');
                    return;
                }
                resolve(res);
            })
            .catch(reject);
    });
}

// parseEDI is the wrapper function that will get the appropriate instructions and send the
// request to our online EDI Library to parse the associated data
export function parseEDI(ediType, data) {
    return new Promise((resolve, reject) => {
        const { instructions = {}, error } = getInstructions(ediType, 'in');
        if (error) {
            reject(`There was an issue loading instructions for ${ediType} reading.`);
        }
        apiReadData(data, instructions)
            .then(function(res) {
                if (!res) {
                    reject('There was an issue communicating with the EDI library');
                    return;
                }
                resolve(res);
            })
            .catch(reject);
    });
}
