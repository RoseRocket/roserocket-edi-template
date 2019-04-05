import fs from 'fs';
import mkdirp from 'mkdirp';
import chalk from 'chalk';
import moment from 'moment';
import * as aws from './aws.js';

const {
    LOCAL_SYNC_DIRECTORY,
    AWS_OUT_ENDPOINT,
    AWS_IN_ENDPOINT,
    LOG_DIRECTORY,
    PROJECT_ROOT_DIRECTORY,
    FILE_IN,
    FILE_OUT,
    DATA_IN,
    DATA_OUT,
    UPLOAD_SUCCESS_DIR,
    UPLOAD_ERROR_DIR,
    TMP_OUT_DIR,
    EDI_FILE_NAMING_TEMPLATE,
    DATA_FILE_NAMING_TEMPLATE,
    GENERATED_EDI_UPLOAD_MODE,
    SOURCE_EDI_DOWNLOAD_MODE,
} = process.env;

const HTTP_OK = 200;
const uploadAction = `${GENERATED_EDI_UPLOAD_MODE}`.toUpperCase();
const downloadAction = `${SOURCE_EDI_DOWNLOAD_MODE}`.toUpperCase();

// printFuncError will output a red, error message to both the console, and a matching message
// to the error logs in the log directory
export function printFuncError(functionName, error) {
    try {
        checkDirectoryStatus(LOG_DIRECTORY);
        const msg = `[ERROR] [${moment(new Date()).format(
            'YYYY-MM-DD HH:mm:ss'
        )}] [${functionName}]: ${error}`;
        const logFile = fs.createWriteStream(
            `${LOG_DIRECTORY}/${moment(new Date()).format('YYYYMMDD')}.error`,
            { flags: 'a' }
        );
        console.log(chalk.red(msg));
        logFile.write(msg + '\n');
        logFile.close();
    } catch (err) {
        console.log(`Issue logging error: ${err}`);
    }
}

// printFuncLog will output a message to both the console and to a log file in the log directory
export function printFuncLog(functionName, obj) {
    try {
        checkDirectoryStatus(LOG_DIRECTORY);
        const msg = `[LOGGER] [${moment(new Date()).format(
            'YYYY-MM-DD HH:mm:ss'
        )}] [${functionName}]: ${obj}`;
        const logFile = fs.createWriteStream(
            `${LOG_DIRECTORY}/${moment(new Date()).format('YYYYMMDD')}.info`,
            { flags: 'a' }
        );
        console.log(msg);
        logFile.write(msg + '\n');
        logFile.close();
    } catch (err) {
        printFuncError(functionName, err.toString());
    }
}

// printFuncWarning is only used to output to the console
export function printFuncWarning(functionName, warning) {
    console.log(chalk.yellow(`[WARNING] [${functionName}]: ${warning}`));
}

export function isArrayEmpty(array) {
    return !array || !Array.isArray(array) || !array.length;
}

export function arrayIfNotEmpty(array) {
    return !isArrayEmpty(array) ? array : undefined;
}

export function quickResponse(res, msg) {
    const data = {
        success: true,
        message: msg,
    };
    res.status(HTTP_OK).json(data);
}

export function isObjectEmpty(obj) {
    return (
        !obj ||
        obj === null ||
        typeof obj !== 'object' ||
        Array.isArray(obj) ||
        !Object.keys(obj).length
    );
}

export function isObject(obj) {
    return typeof obj === 'object' && !Array.isArray(obj);
}

export function objectIfNotEmpty(obj) {
    return !isObjectEmpty(obj) ? obj : undefined;
}

// taken from https://stackoverflow.com/a/12502559
export function randomString() {
    return Math.random()
        .toString(36)
        .slice(2);
}

//simple local file copy to backup location, no callback support, for upload
//adding 'prefix' argument to help different functions identify 'their' files
export function localFileBackup(src, options = {}) {
    const { isError, prefix } = options;
    const folder = checkDirectoryStatus(isError ? UPLOAD_ERROR_DIR : UPLOAD_SUCCESS_DIR);
    const filename = src.substring(src.lastIndexOf('/') + 1);
    const dest = `${folder}/${prefix ? prefix + '_' : ''}${filename}`;
    fs.copyFileSync(src, dest, err => {
        if (err) {
            printFuncError('localFileBackup', `localFileBackup: ${dest} ${err}`);
            return err;
        }
    });
}

// simple local file move/copy; set 'copy' to true if removal of original file) is not desired
export function localFileMove(srcDir, destDir, fileName, keepOriginal = false) {
    if (!fs.existsSync(destDir)) {
        mkdirp.sync(destDir);
    }
    const srcPath = `${srcDir}/${fileName}`;
    const destPath = `${destDir}/${fileName}`;
    console.log(`Moving file from ${srcPath} to ${destPath} ...`);
    if (!fs.existsSync(srcPath)) {
        const errMsg = `Error moving file from ${srcPath} to ${destPath}; check to see if error catching already tagged file as 'error'`;
        printFuncError('localFileMove', errMsg);
        return new error(errMsg);
    }
    if (keepOriginal) {
        fs.copyFileSync(srcPath, destPath, err => {
            if (err) {
                printFuncError('localFileMove', 'ERROR: ' + err);
                return err;
            }
        });
        return;
    }
    fs.renameSync(srcPath, destPath, err => {
        if (err) {
            printFuncError('localFileMove', 'ERROR: ' + err);
            return err;
        }
    });
    return;
}

// syncLocalFilesToBeProcessed will retrieve all 'new' files in a local directory, to be processed
// just as any other file would be from another source.
export function syncLocalFilesToBeProcessed(srcDir, destDir) {
    const files = fs
        .readdirSync(srcDir, { withFileTypes: true })
        .filter(dirent => !dirent.isDirectory())
        .map(dirent => dirent.name);

    if (files.length > 0) {
        for (const file of files) {
            const err = localFileMove(srcDir, destDir, file);
            if (err) return err;
        }
    }
}

// sendAndBackupFile will determine what to to do with the result from the EDI Playground.
export function sendAndBackupFile(res, filePath, tmpPath, jsonData = false) {
    const content = jsonData ? JSON.stringify(res.result) : res.result;

    // Create temporary file at tmpPath; local copy is required for certain upload types
    let err = writeStringResultToFile(content, tmpPath);
    if (err) {
        printFuncError('processOutboundLocalFile', err.toString()); // print call stack
        localFileBackup(tmpPath, { isError: true, pr: 'upload_error_' });
        return err;
    }

    switch (uploadAction) {
        case 'AWS':
            aws.fileCopy(tmpPath, AWS_OUT_ENDPOINT).catch(error => {
                err = error;
            });
            break;
        default:
            err = writeStringResultToFile(content, filePath);
            break;
    }

    // If upload action fails, log error, backup file, and return err
    if (err) {
        printFuncError('processOutboundLocalFile', err.toString()); // print call stack
        localFileBackup(UPLOAD_ERROR_DIR, { isError: true, pr: 'upload_error_' });
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
        default:
            return new Promise((resolve, reject) => {
                try {
                    syncLocalFilesToBeProcessed(FILE_IN, LOCAL_SYNC_DIRECTORY);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
    }
}

// simple function that will ensure that the requested folder exists
export function checkDirectoryStatus(folder) {
    // setup a necessarily open directory if configuration isn't setup properly
    const defaultDirectory = '/tmp/edi-config-failure';
    try {
        if (folder == null || folder.trim() == '') {
            throw `Configuration failure: folder not set. Returning ${defaultDirectory}`;
        }
        if (!fs.existsSync(folder)) {
            console.log('FOLDER DOES NOT EXIST - ATTEMPTING TO MAKE ----------' + folder);
            mkdirp.sync(folder);
        }
        return folder;
    } catch (err) {
        // Don't want to potentially halt server, still notify that directory creation failed
        printFuncError('checkDirectoryStatus', err.toString()); // print call stack
        if (!fs.existsSync(defaultDirectory)) {
            mkdirp.sync(defaultDirectory);
        }
        return defaultDirectory;
    }
}

// generateFileNames will genereate both the name of a file and the target destinations
// of all files of this type, which may or may not be used based on the output configuration
export function generateFileNames(ediType, ediFile = false) {
    const nameTemplate = ediFile ? EDI_FILE_NAMING_TEMPLATE : DATA_FILE_NAMING_TEMPLATE;
    const timeStamp = moment(new Date()).format('YYYYMMDDHHmmss');
    return {
        filePath:
            (ediFile ? checkDirectoryStatus(FILE_OUT) : checkDirectoryStatus(DATA_OUT)) +
            '/' +
            nameTemplate.replace('{EDI_TYPE}', ediType).replace('{TIMESTAMP}', timeStamp),
        tmpPath:
            checkDirectoryStatus(TMP_OUT_DIR) +
            '/' +
            nameTemplate.replace('{EDI_TYPE}', ediType).replace('{TIMESTAMP}', timeStamp),
    };
}

export function writeStringResultToFile(result, path) {
    fs.writeFileSync(path, result, error => {
        if (error) {
            return error;
        }
    });
}

export function writeJSONResultToFile(result, path) {
    fs.writeFileSync(path, JSON.stringify(result), error => {
        if (error) {
            return error;
        }
    });
}

// readLocalFile will get the unprocessed string contents of any file in the configured directory
export function readLocalFile(file, ediFile = false) {
    try {
        const fileName = ediFile ? `${FILE_IN}/${file}` : `${DATA_IN}/${file}`;
        console.log(`Attempting to load file: ${fileName}`);
        const contents = fs.readFileSync(fileName, { encoding: 'utf8' });
        return { data: contents };
    } catch (error) {
        return { error };
    }
}

// readLocalJsonFile will get the json contents of any file in the configured directory
export function readLocalJsonFile(file, ediFile = false) {
    try {
        const fileName = ediFile ? `${FILE_IN}/${file}` : `${DATA_IN}/${file}`;
        console.log(`Attempting to load file: ${fileName}`);
        const contents = fs.readFileSync(fileName, { encoding: 'utf8' });
        return { data: JSON.parse(contents) };
    } catch (error) {
        return { error };
    }
}

// getInstructions will attempt to locate the appropriate configuration for EDI interpretation,
// based on the EDI Type (204, 214, 990) and whether the file is incoming 'in' (to be parsed) or
// outgoing 'out' (to be generated)
export function getInstructions(ediType, method) {
    try {
        const fileName = `${PROJECT_ROOT_DIRECTORY}/instructions/${ediType}_${method}_instructions.txt`;
        const contents = fs.readFileSync(fileName, { encoding: 'utf8' });
        return { instructions: JSON.parse(contents) };
    } catch (error) {
        return { error };
    }
}
