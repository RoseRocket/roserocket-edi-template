import fs from 'fs';
import { generateEDI, parseEDI } from '../api/ediGambitApi';
import { generateEdiRequestBody } from '../api/rrApi';
import {
    EDI_TYPES,
    EDI_997_STATUS_TYPES,
    EDI_997_STATUS_DEFAULT_MESSAGES,
    EDI_867_ERROR_CODES,
} from '../constants/constants';
import { rrAuthenticate, rrAuthenticateWithSubdomain } from '../utils/rrAuthenticate.js';
import * as util from '../utils/utils';
import * as aws from '../utils/aws';
import * as sftp from '../utils/sftp';
import * as rrapi from '../api/rrApi.js';
import * as ediOutHelpers from '../out/edi.js';

const {
    AWS_OUT_ENDPOINT,
    AWS_IN_ENDPOINT,
    SFTP_OUT_ENDPOINT,
    SFTP_IN_ENDPOINT,
    DOWNLOAD_SUCCESS_DIR,
    DOWNLOAD_ERROR_DIR,
    FILE_IN,
    GENERATED_EDI_UPLOAD_MODE,
    LOCAL_SYNC_DIRECTORY,
    SOURCE_EDI_DOWNLOAD_MODE,
    ORG_NAME,
} = process.env;

const uploadAction = `${GENERATED_EDI_UPLOAD_MODE}`.toUpperCase();
const downloadAction = `${SOURCE_EDI_DOWNLOAD_MODE}`.toUpperCase();
const SUPPORTED_ORDER_STATUSES = { in_transit: 'AF', delivered: 'X1' };
const PROCESS_DELAY = 1000;
const EDI_TYPE_SEARCH = /\nST\*[0-9]{2,3}\*/g;
const EDI_ERROR_ASN_START = /[- ]{5,}/g;
const EDI_ERROR_ASN_MSG_PARSE = /^[0-9]* (IB|J)[0-9]* /g;

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
                    util.printFuncError(
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
                                const { filePath = '', tmpPath = '' } = util.generateFileNames(
                                    ediType,
                                    true
                                );
                                sendAndBackupFile(res, filePath, tmpPath);
                            })
                            .catch(err => util.printFuncError('create204FromRoseRocket', err));
                    })
                    .catch(err => util.printFuncError('create204FromRoseRocket', err));
            })
            .catch(err => util.printFuncError('create204FromRoseRocket', err));
        util.quickResponse(res);
        return;
    } catch (error) {
        util.printFuncError('create204FromRoseRocket', error); // print call stack
        return next({ error: error.toString() });
    }
}

// create856FromRoseRocket is a function that creates an EDI 856 (ASN - Advance ship notice) file
// which will be sent to the desired receiver.
export function create856FromRoseRocket(req, res, next) {
    try {
        let orderID;
        let error;
        const { order = {}, order_ids = [], order_id } = req.body;
        const ediType = '856';

        var orderIDs = [];
        orderID = order.id || order_id;
        if ((orderID === undefined || orderID == '') && order_ids.length > 0) {
            orderIDs = order_ids;
        } else {
            orderIDs[0] = orderID;
        }
        rrAuthenticateWithSubdomain(req.query.subdomain)
            .then((res1 = {}) => {
                if (!res1.access_token) {
                    util.printFuncError(
                        'create856FromRoseRocket',
                        'Authorization Failed - Check Org credentials in environment settings.'
                    );
                    return;
                }
                ediOutHelpers
                    .recursiveLoadUCCData(res1.access_token, orderIDs, [])
                    .then(function(res2) {
                        if (!res2) {
                            error = `Order with ID ${orderID} could not be found for this Org (${ORG_NAME})`;
                            return next({ error });
                        }

                        const { orders = [] } = res2;

                        rrapi
                            .getRequestEDITransaction(res1.access_token, orders)
                            .then(function(res3) {
                                if (!res3) {
                                    error = `Unknown error when attempting to generate system EDI Transaction`;
                                    return next({ error });
                                }
                                const { edi_group = {} } = res3;
                                var shipment = {
                                    ...orders[0],
                                    orders,
                                };
                                const orderData = ediOutHelpers.processOrderForASN(
                                    shipment,
                                    edi_group
                                ); // <--- RR integration webhook expects single order requests

                                const data = generateEdiRequestBody([shipment], {
                                    groupControlNumber: orderData.groupControlNumber,
                                    transactionSetHeader: ediType,
                                    functionalGroupHeader: 'SH',
                                    segmentTerminator: '\r\n',
                                    acknowledgmentRequested: '0',
                                    usageIndicator: 'T',
                                    __vars: {
                                        totalHL: orderData.totalHL,
                                        totalPcs: orderData.totalPcs,
                                    },
                                });

                                // generate 856 EDI data for that company
                                generateEDI(ediType, data)
                                    .then(function(res = {}) {
                                        const {
                                            filePath = '',
                                            tmpPath = '',
                                        } = util.generateFileNames(ediType, true);
                                        sendAndBackupFile(res, filePath, tmpPath);
                                    })
                                    .catch(err =>
                                        util.printFuncError('create856FromRoseRocket', err)
                                    );
                            })
                            .catch(err =>
                                util.printFuncError('create856FromRoseRocket - requestEDI', err)
                            );
                    })
                    .catch(err =>
                        util.printFuncError('create856FromRoseRocket - GetOrderWithSSCC18', err)
                    );
            })
            .catch(err => util.printFuncError('create856FromRoseRocket - Auth', err));
        util.quickResponse(res);
        return;
    } catch (error) {
        util.printFuncError('create856FromRoseRocket', error); // print call stack
        return next({ error: error.toString() });
    }
}

// processInboundDataFile will load a data file (stored locally) and attempt to process it,
// resulting in a tmp file created with the 'official' version created at the configured location
export function processInboundEDIFile(ediFile, ediType) {
    try {
        console.log(`Attempting to process local inbound file: ${ediFile}...`);
        const { data = {}, error } = util.readLocalFile(ediFile, true);
        if (error) {
            util.printFuncError('processInboundLocalFile', error); // print call stack
            return;
        }
        parseEDI(ediType, data)
            .then(function(res) {
                const { filePath = '', tmpPath = '' } = util.generateFileNames(ediType);
                sendAndBackupFile(res, filePath, tmpPath, true);
            })
            .catch(err => util.printFuncError('processInboundLocalFile', err));
    } catch (error) {
        util.printFuncError('processInboundLocalFile', error); // print call stack
        return;
    }
}

// processOutboundDataFile will load a data file (stored locally) and attempt to process it,
// resulting in a tmp file created with the 'official' version created at the configured location
export function processOutboundDataFile(dataFile, ediType) {
    try {
        console.log(`Attempting to process local outbound file: ${dataFile}...`);
        const { data = {}, error } = util.readLocalJsonFile(dataFile);
        if (error) {
            util.printFuncError('processOutboundLocalFile', error); // print call stack
            return;
        }
        generateEDI(ediType, data)
            .then(function(res = {}) {
                const { filePath = '', tmpPath = '' } = util.generateFileNames(ediType, true);
                sendAndBackupFile(res, filePath, tmpPath);
            })
            .catch(err => util.printFuncError('processOutboundLocalFile', err));
    } catch (error) {
        util.printFuncError('processOutboundLocalFile', error); // print call stack
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
            .catch(err =>
                util.printFuncError('processInboundFiles - retrieveInboundFiles.catch', err)
            );
        return;
    } catch (error) {
        util.printFuncError('processInboundFiles - Server Error', error); // print call stack
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
    const fileContent = fs.readFileSync(`${LOCAL_SYNC_DIRECTORY}/${file}`, 'utf8');

    // SEARCH FILE FOR EDI CONTEXT
    var ediType = `${fileContent.match(EDI_TYPE_SEARCH)}`.replace(/\D/g, '');
    const fileTypes = [EDI_TYPES['997'], EDI_TYPES['864']];
    if (ediType != '' && fileTypes.includes(ediType)) {
        util.printFuncLog('FileTypeMatch:', { ediType, file });
        markFileAsProcessing(file)
            .then(res => {
                processFile(file, ediType);
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
                            `processFile - ${ediType} - Message Data Missing`,
                            `Message Data Missing`,
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
                                        markFileAsError(
                                            file,
                                            `processFile - updateOrderExternalID - ${ediType}`,
                                            err
                                        )
                                    );
                                    break;

                                case EDI_TYPES['214']:
                                    updateOrderStatus(order).catch(err =>
                                        markFileAsError(
                                            file,
                                            `processFile - updateOrderStatus - ${ediType}`,
                                            err
                                        )
                                    );
                                    break;

                                case EDI_TYPES['997']:
                                    acknowledgeASN(order).catch(err =>
                                        markFileAsError(
                                            file,
                                            `processFile - acknowledgeASN - ${ediType}`,
                                            err
                                        )
                                    );
                                    break;
                                case EDI_TYPES['864']:
                                    markASNasError(order, file).catch(err =>
                                        markFileAsError(
                                            file,
                                            `processFile - acknowledgeASN - ${ediType}`,
                                            err
                                        )
                                    );
                                    break;
                            }
                        }
                    }
                    markFileAsSuccess(file);
                })
                .catch(err => {
                    util.printFuncError('processFiles', err); // print call stack
                    markFileAsError(file, `processFile - ${ediType} - parseEDI error`, error, true);
                    return;
                });
        } catch (err) {
            util.printFuncError('processFiles', err); // print call stack
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
            util.printFuncWarning(
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
        let err = util.localFileMove(
            LOCAL_SYNC_DIRECTORY,
            `${LOCAL_SYNC_DIRECTORY}/processing`,
            file
        );
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
            case 'SFTP':
                sftp.markFileAsProcessing(localFilePath, file)
                    .then(resolve)
                    .catch(reject);
                return;
            default:
                try {
                    // to copy the markFileAsProcessing feature, after moving the file we make a copy in the
                    // "FILE_IN" directory
                    let err = util.localFileMove(
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
    util.localFileMove(
        `${LOCAL_SYNC_DIRECTORY}/processing`,
        `${DOWNLOAD_SUCCESS_DIR}`,
        fileName,
        true
    );
}

// Maintain a local backup of files that were succesfully marked as processing but encountered an error
export function markFileAsError(fileName, functionName, msg, verbose) {
    if (verbose || true) {
        util.printFuncError(functionName, msg);
    }
    util.printFuncError(functionName, `Error Updating from file -- ${fileName}`);
    util.localFileMove(
        `${LOCAL_SYNC_DIRECTORY}/processing`,
        `${DOWNLOAD_ERROR_DIR}`,
        fileName,
        true
    );
}

// acknowledgeASN will load the associated ASN and respond with the appropriate
export function acknowledgeASN(ediData) {
    return new Promise((resolve, reject) => {
        const gcnId = util.trimLeadingZeroes(`${ediData.gcn_id}`);
        if (gcnId == '') {
            reject('Could not load GroupControlID');
        }

        //typicaly pattern: Auth -> LoadByExternalID -> ReviseByID
        let authToken;
        rrAuthenticate()
            .then(function(res1 = {}) {
                if (!res1.access_token) {
                    reject('Authorization Failed - Check Org credentials in environment settings.');
                    return;
                }

                authToken = res1.access_token;
                ediOutHelpers
                    .loadEDITransaction(authToken, gcnId, res1.orgId)
                    .then(function(res2) {
                        const { edi_group: ediGroup = {} } = res2;

                        authToken = res2.authToken;
                        ediGroup.response_status =
                            EDI_997_STATUS_TYPES[ediData.gcn_status.toUpperCase()];

                        for (const r of ediData.responses) {
                            ediGroup.orders
                                .filter(
                                    o =>
                                        o.transaction_set_number ==
                                        util.trimLeadingZeroes(`${r.tsn_id}`)
                                )
                                .forEach(function(e) {
                                    const responseCode = r.response_code.toUpperCase();
                                    e.response_status = EDI_997_STATUS_TYPES[responseCode];
                                    e.message = EDI_997_STATUS_DEFAULT_MESSAGES[responseCode];
                                });
                        }
                        rrapi
                            .updateEDITransactionData(authToken, ediGroup)
                            .then(resolve)
                            .catch(reject);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
}

// markASNasError will process a file that's been identified as an 867 and attempt to update Roserocket
// with the status changes.  This includes marking the order as rejected and including the message
// within the internal notes of the order
export function markASNasError(ediData, file) {
    return new Promise((resolve, reject) => {
        const gcnId = util.trimLeadingZeroes(`${ediData.gcn_id}`);
        if (gcnId == '') {
            reject('Could not load GroupControlID');
        }

        //typicaly pattern: Auth -> LoadByExternalID -> ReviseByID
        let authToken;
        rrAuthenticate()
            .then(function(res1 = {}) {
                if (!res1.access_token) {
                    reject('Authorization Failed - Check Org credentials in environment settings.');
                    return;
                }

                authToken = res1.access_token;

                //consume message data and determine which lines can be evaluated for proper execution
                var actionableLines = [];
                for (const mit of ediData.messages) {
                    var startAdding = false;
                    for (const line of mit.lines) {
                        if (line.message.match(EDI_ERROR_ASN_START)) {
                            startAdding = true;
                            continue;
                        }
                        if (startAdding) {
                            const ids = `${line.message.match(EDI_ERROR_ASN_MSG_PARSE)}`.split(' ');
                            const message = line.message.replace(EDI_ERROR_ASN_MSG_PARSE, '');
                            actionableLines.push({
                                gcnId: util.trimLeadingZeroes(ids[0]),
                                errorCode: ids[1],
                                message,
                            });
                        }
                    }
                }

                // run the update code for any actionable lines; make sure each execution can flag file
                // as having encounterd an error
                for (const errMessage of actionableLines) {
                    ediOutHelpers
                        .loadEDITransaction(authToken, errMessage.gcnId, res1.orgId)
                        .then(function(res2) {
                            const { edi_group: ediGroup = {} } = res2;

                            authToken = res2.authToken;
                            ediGroup.orders.forEach(function(e) {
                                e.response_status = EDI_997_STATUS_TYPES['R'];
                                e.message = `${
                                    EDI_867_ERROR_CODES[errMessage.errorCode]
                                } \nDetails:${errMessage.message} \n${file}`;
                            });
                            rrapi.updateEDITransactionData(authToken, ediGroup).catch(reject);
                        })
                        .catch(err => {
                            markFileAsError(file, `markASNasError - loadEDITransaciton - 867`, err);
                        });
                }

                resolve({ success: true });
            })
            .catch(reject);
    });
}

// sendAndBackupFile will determine what to to do with the result from the EDI Playground.
export function sendAndBackupFile(res, filePath, tmpPath, jsonData = false) {
    // The following will trim the ^M special carriage return at the end of file. Did a fair amount
    // of searching, only this method was working consistently to remove this value
    const content = jsonData
        ? JSON.stringify(res.result.replace(/[\x00-\x1F\x7F-\x9F]$/g, ''))
        : res.result.replace(/[\x00-\x1F\x7F-\x9F]$/g, '');

    // Create temporary file at tmpPath; local copy is required for certain upload types
    let err = util.writeStringResultToFile(content, tmpPath);
    if (err) {
        util.printFuncError('processOutboundLocalFile', err.toString()); // print call stack
        util.localFileBackup(tmpPath, { isError: true, pr: 'upload_error_' });
        return err;
    }

    switch (uploadAction) {
        case 'AWS':
            aws.fileCopy(tmpPath, AWS_OUT_ENDPOINT).catch(error => {
                err = error;
            });
            break;
        case 'SFTP':
            sftp.fileCopy(tmpPath, SFTP_OUT_ENDPOINT).catch(error => {
                util.printFuncError('sendAndBackupFile - AFTER', error); // print call stack
                util.localFileBackup(tmpPath, { isError: true, pr: 'upload_error_' });
            });
            return;
        default:
            err = util.writeStringResultToFile(content, filePath);
            break;
    }

    // If upload action fails, log error, backup file, and return err
    if (err) {
        util.printFuncError('processOutboundLocalFile', err.toString()); // print call stack
        util.localFileBackup(tmpPath, { isError: true, pr: 'upload_error_' });
        return err;
    }
    return;
}

// retrieveInboundFiles will get new EDI files from the configured source to the local sync directory,
// even if they're local data files.
export function retrieveInboundFiles() {
    switch (downloadAction) {
        case 'AWS':
            return aws.fileSync(AWS_IN_ENDPOINT, LOCAL_SYNC_DIRECTORY, false);
        case 'SFTP':
            return sftp.fileSyncFromSFTP(SFTP_IN_ENDPOINT, LOCAL_SYNC_DIRECTORY);
        default:
            return new Promise((resolve, reject) => {
                try {
                    util.syncLocalFilesToBeProcessed(FILE_IN, LOCAL_SYNC_DIRECTORY);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
    }
}
