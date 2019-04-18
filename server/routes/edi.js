import fs from 'fs';
import { generateEDI, parseEDI } from '../api/ediGambitApi';
import { generateEdiRequestBody } from '../api/rrApi';
import { EDI_TYPES } from '../constants/constants';
import { rrAuthenticate } from '../utils/rrAuthenticate.js';
import {
    readLocalFile,
    readLocalJsonFile,
    printFuncError,
    printFuncWarning,
    retrieveInboundFiles,
    generateFileNames,
    sendAndBackupFile,
    quickResponse,
    localFileMove,
} from '../utils/utils';
import * as aws from '../utils/aws';
import * as rrapi from '../api/rrApi.js';

const {
    ORG_NAME,
    LOCAL_SYNC_DIRECTORY,
    FILE_IN,
    SOURCE_EDI_DOWNLOAD_MODE,
    DOWNLOAD_SUCCESS_DIR,
    DOWNLOAD_ERROR_DIR,
} = process.env;

const downloadAction = `${SOURCE_EDI_DOWNLOAD_MODE}`.toUpperCase();
const SUPPORTED_ORDER_STATUSES = { in_transit: 'AF', delivered: 'X1' };
const PROCESS_DELAY = 1000;

// create204FromRoseRocket is a function called from the only webhook that's currently configured
// in the server.js file. As the name would imply, it creates a 204 EDI file from the records that
// exist in Roserockets systems; the resulting EDI file should be imported into your system.
export function create204FromRoseRocket(req, res, next) {
    try {
        let orderID;
        let error;
        const { order = {}, order_id } = req.body;
        const ediType = '204';

        //Currently unsure of the variable request body's from different webhooks, attempting to generalize for now.  ~ANDO
        orderID = order.id || order_id;
        rrAuthenticate()
            .then((res1 = {}) => {
                if (!res1.access_token) {
                    printFuncError(
                        'create204FromFormOrderID',
                        'Authorization Failed - Check Org credentials in environment settings.'
                    );
                    return;
                }
                rrapi
                    .getOrder(res1.access_token, orderID)
                    .then(function(res2) {
                        if (!res2) {
                            error = `Order with ID ${orderID} could not be found for this Org (${ORG_NAME})`;
                            return next({ error });
                        }
                        const orders = [res2.order]; // <--- RR integration webhook expects single order requests
                        const data = generateEdiRequestBody(orders);

                        // generate 204 EDI data for that company
                        generateEDI(ediType, data)
                            .then(function(res = {}) {
                                const { filePath = '', tmpPath = '' } = generateFileNames(
                                    ediType,
                                    true
                                );
                                sendAndBackupFile(res, filePath, tmpPath);
                            })
                            .catch(err => printFuncError('create204FromRoseRocket', err));
                    })
                    .catch(err => printFuncError('create204FromRoseRocket', err));
            })
            .catch(err => printFuncError('create204FromRoseRocket', err));
        quickResponse(res);
        return;
    } catch (error) {
        printFuncError('create204FromRoseRocket', error); // print call stack
        return next({ error: error.toString() });
    }
}

// processInboundDataFile will load a data file (stored locally) and attempt to process it,
// resulting in a tmp file created with the 'official' version created at the configured location
export function processInboundEDIFile(ediFile, ediType) {
    try {
        console.log(`Attempting to process local inbound file: ${ediFile}...`);
        const { data = {}, error } = readLocalFile(ediFile, true);
        if (error) {
            printFuncError('processInboundLocalFile', error); // print call stack
            return;
        }
        parseEDI(ediType, data)
            .then(function(res) {
                const { filePath = '', tmpPath = '' } = generateFileNames(ediType);
                sendAndBackupFile(res, filePath, tmpPath, true);
            })
            .catch(err => printFuncError('processInboundLocalFile', err));
    } catch (error) {
        printFuncError('processInboundLocalFile', error); // print call stack
        return;
    }
}

// processOutboundDataFile will load a data file (stored locally) and attempt to process it,
// resulting in a tmp file created with the 'official' version created at the configured location
export function processOutboundDataFile(dataFile, ediType) {
    try {
        console.log(`Attempting to process local outbound file: ${dataFile}...`);
        const { data = {}, error } = readLocalJsonFile(dataFile);
        if (error) {
            printFuncError('processOutboundLocalFile', error); // print call stack
            return;
        }
        generateEDI(ediType, data)
            .then(function(res = {}) {
                const { filePath = '', tmpPath = '' } = generateFileNames(ediType, true);
                sendAndBackupFile(res, filePath, tmpPath);
            })
            .catch(err => printFuncError('processOutboundLocalFile', err));
    } catch (error) {
        printFuncError('processOutboundLocalFile', error); // print call stack
        return;
    }
}

// processInboundFiles will sync EDI files with a preconfigured 'source' file directory to a temporary
// 'sync' directory for immediate processing; the original files are then removed from the origin
// to prevent duplicate processing if proper cleanup fails.  This function is intended to be run on
// EDI Files only, as data files are most likely processed manually
export function processInboundFiles() {
    try {
        console.log('Attempting to process inbound files...');
        // sync files against AWS S3 endpoint, then process
        retrieveInboundFiles()
            .then(() => {
                //readdirSync returns file names in assending order, accurate timestamps means we can process in order without worry
                const files = fs
                    .readdirSync(LOCAL_SYNC_DIRECTORY, { withFileTypes: true })
                    .filter(dirent => !dirent.isDirectory())
                    .map(dirent => dirent.name);
                console.log(files);

                if (!files.length) {
                    console.log('No files to process.');
                    return;
                }
                setTimeout(() => {
                    timedFileProcess(files);
                }, PROCESS_DELAY);
            })
            .catch(err => printFuncError('processInboundFiles', err));
    } catch (error) {
        printFuncError('processInboundFiles', error); // print call stack
        return;
    }
}

// Processing files on a delay, local testing was showing some unintended behaviors when bombarding update
// requests to local ops, likely due to cached results from original load of orders when executing update requests in a race.
// This is a stop-gap measure that should fix the problem because files will be executed in order,
// and multiple updates in a single file *shouldn't* exist.
export function timedFileProcess(files = {}) {
    if (!files.length) {
        return;
    }
    const file = files.shift();
    const fileTypes = [EDI_TYPES['990'], EDI_TYPES['214']];
    for (const fileType of fileTypes)
        if (file.includes(`${fileType}_`)) {
            markFileAsProcessing(file)
                .then(res => {
                    processFile(file, fileType);
                })
                .catch(err => {
                    markFileAsError(file, `timedFileProcess - ${file} - error`, err, true);
                });
        }
    setTimeout(function() {
        timedFileProcess(files);
    }, PROCESS_DELAY);
}

// processFile will accept a single file and process the contents, one at a time.  This function
// is currently preconfigured to work with RoseRocket systems; if you need to integrate with a new system
// you can inject your code below; it's been colloquially tagged 'POI-1'
export function processFile(file, ediType) {
    fs.readFile(`${LOCAL_SYNC_DIRECTORY}/processing/${file}`, 'utf8', (error, data) => {
        if (error) {
            markFileAsError(file, `processFile - File Read Error`, error, true);
            return;
        }
        try {
            parseEDI(ediType, data)
                .then(res => {
                    const { groups = [] } = res.result;
                    if (!groups.length) {
                        markFileAsError(
                            file,
                            `processFile - ${ediType} - Order Data Missing`,
                            `Order Data Missing`,
                            true
                        );
                        return;
                    }
                    for (const group of groups) {
                        if (!group.orders) {
                            continue;
                        }
                        for (const order of group.orders) {
                            // POI-1: Handling files by type, insert custom handlers as desired here.
                            switch (ediType) {
                                case EDI_TYPES['990']:
                                    updateOrderExternalID(order).catch(err =>
                                        markFileAsError(file, `processFile - ${ediType}`, err)
                                    );
                                    break;

                                case EDI_TYPES['214']:
                                    updateOrderStatus(order).catch(err =>
                                        markFileAsError(file, `processFile - ${ediType}`, err)
                                    );
                                    break;
                            }
                        }
                    }
                    markFileAsSuccess(file);
                })
                .catch(err => {
                    printFuncError('processFiles', err); // print call stack
                    markFileAsError(file, `processFile - ${ediType} - parseEDI error`, error, true);
                    return;
                });
        } catch (err) {
            printFuncError('processFiles', err); // print call stack
            markFileAsError(file, `processFile - ${ediType}`, err, true);
            return;
        }
    });
}

// RR Integration function, only dealing with approved 990s, this function updates Roserocket's
// internal records to match the IDs in your system
export function updateOrderExternalID(orderData) {
    return new Promise((resolve, reject) => {
        const orderID = `full_id:${orderData.full_id}`;
        //typicaly pattern: Auth -> LoadByExternalID -> ReviseByID
        let authToken;
        rrAuthenticate()
            .then(function(res1 = {}) {
                if (!res1.access_token) {
                    reject('Authorization Failed - Check Org credentials in environment settings.');
                    return;
                }
                authToken = res1.access_token;
                return rrapi.getOrder(authToken, orderID);
            })
            .then(function(res2) {
                if (!res2) {
                    reject(
                        `Order with ID ${orderID} could not be found for this Org (${ORG_NAME})`
                    );
                    return;
                }
                const { order = {} } = res2;
                const { customer = {} } = order;
                //'Revise' Platform API endpoint only requires the fields that are being updated; for safety, only send the external_id
                return rrapi.reviseOrder(authToken, customer.id, order.id, {
                    external_id: orderData.external_id,
                });
            })
            .then(resolve)
            .catch(reject);
    });
}

// updateOrderStatus will read 214 files and identify the shipment status field. Based on the
// 'SUPPORTED_ORDER_STATUSES' array configured at the top, it'll update the status of these shipments
// in RoseRockets systems. Your status codes may be different from those configured, please update
// as necessary
export function updateOrderStatus(orderData = {}) {
    return new Promise((resolve, reject) => {
        const orderID = `full_id:${orderData.full_id}`;
        const { status_code: orderStatus } = orderData;
        //Don't continue if the status is not within the confines of what we've agreed to support
        if (!(Object.values(SUPPORTED_ORDER_STATUSES).indexOf(orderStatus) > -1)) {
            printFuncWarning(
                'updateOrderStatus',
                `Order Change status not supported -- OrderID: ${
                    orderData.full_id
                } Status: ${orderStatus}`
            ); // print call stack
            resolve({ state: 'fulfilled', result: 'No change in status.' });
            return;
        }
        //typicaly pattern: Auth -> LoadByExternalID -> Update Status
        let authToken;
        rrAuthenticate()
            .then((res1 = {}) => {
                if (!res1.access_token) {
                    reject('Authorization Failed - Check Org credentials in environment settings.');
                    return;
                }
                authToken = res1.access_token;
                return rrapi.getOrder(authToken, orderID);
            })
            .then(res2 => {
                if (!res2) {
                    reject(
                        `Order with ID ${orderID} could not be found for this Org (${ORG_NAME})`
                    );
                    return;
                }
                const { order = {} } = res2;
                const { customer = {} } = order;
                // Status updates we are allowing currently are AF & X1, mapped below in comments
                switch (orderStatus) {
                    case SUPPORTED_ORDER_STATUSES.in_transit:
                        return rrapi.markInTransit(authToken, customer.id, order.id);
                    case SUPPORTED_ORDER_STATUSES.delivered:
                        return rrapi.markDelivered(authToken, customer.id, order.id);
                    default:
                        reject(
                            new Error(
                                `Unhandled, unregistered Order Status. Status: ${orderStatus}`
                            )
                        );
                        break;
                }
                reject('Unhandled Order Status update stream.');
            })
            .then(resolve)
            .catch(reject);
    });
}

// To prevent double-counting with file uploads from client, sync against local directory, mv files to processing, sync local directory against s3 bucket with --delete
export function markFileAsProcessing(file) {
    return new Promise((resolve, reject) => {
        const localFilePath = `${LOCAL_SYNC_DIRECTORY}/processing/${file}`;
        let err = localFileMove(LOCAL_SYNC_DIRECTORY, `${LOCAL_SYNC_DIRECTORY}/processing`, file);
        if (err) {
            reject(err);
        }

        //only run file cleanup on succesfully copied files
        if (!fs.existsSync(localFilePath)) {
            reject(
                `Unhandled error when marking file as processing - ${localFilePath} - ${fs.existsSync(
                    localFilePath
                )}`
            );
            return;
        }

        switch (downloadAction) {
            case 'AWS':
                aws.markFileAsProcessing(localFilePath, file)
                    .then(resolve)
                    .catch(reject);
                return;
            default:
                try {
                    // to copy the markFileAsProcessing feature, after moving the file we make a copy in the
                    // "FILE_IN" directory
                    let err = localFileMove(
                        `${LOCAL_SYNC_DIRECTORY}/processing`,
                        `${FILE_IN}/processing`,
                        file,
                        true
                    );
                    if (err) {
                        reject(err);
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
        }
    });
}
// Maintain a local backup of succesfully processed files. Remove if necessary
export function markFileAsSuccess(fileName) {
    localFileMove(`${LOCAL_SYNC_DIRECTORY}/processing`, `${DOWNLOAD_SUCCESS_DIR}`, fileName, true);
}

// Maintain a local backup of files that were succesfully marked as processing but encountered an error
export function markFileAsError(fileName, functionName, msg, verbose) {
    if (verbose) {
        printFuncError(functionName, msg);
    }
    printFuncError(functionName, `Error Updating from file -- ${fileName}`);
    localFileMove(`${LOCAL_SYNC_DIRECTORY}/processing`, `${DOWNLOAD_ERROR_DIR}`, fileName, true);
}
