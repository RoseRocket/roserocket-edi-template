import { printFuncError, checkDirectoryStatus } from '../utils/utils';
const path = require('path');
const client = require('ssh2-sftp-client');
const { SFTP_IN_ENDPOINT, SFTP_HOST, SFTP_PORT, SFTP_USERNAME, SFTP_PASSWORD } = process.env;

const connectionConfig = {
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USERNAME,
    password: SFTP_PASSWORD,
};

// Unlike AWS and local file copy, SFTP requires the target file name
// This additional function will include the generated filename in the target path
export function getSFTPFilePath(src, dest) {
    const filename = `/${path.basename(src)}`;
    return dest + filename;
}

//Copy files to/from SFTP location
export function fileCopy(src, dest) {
    const sftp = new client();
    return new Promise((resolve, reject) => {
        sftp.connect(connectionConfig)
            .then(() => {
                return sftp.put(src, getSFTPFilePath(src, dest));
            })
            .then(() => sftp.end())
            .then(resolve)
            .catch(err => {
                // need to always close connection, even on error
                sftp.end();
                reject(err);
            });
    });
}

//Sync SFTP to local sync directory
export function fileSyncFromSFTP(src, dest) {
    const sftp = new client();
    checkDirectoryStatus(dest);
    return new Promise((resolve, reject) => {
        sftp.connect(connectionConfig)
            .then(() => {
                return sftp.list(src);
            })
            .then(res => {
                // sftp.list will return directory type files; need to filter out
                const files = res.filter(file => file.type != 'd');
                return recursiveFileSync(sftp, files, src, dest);
            })
            .then(() => sftp.end())
            .then(resolve)
            .catch(err => {
                // need to always close connection, even on error
                sftp.end();
                reject(err);
            });
    });
}

// need to recursively call sftp fastGet in order to ensure that the full list of files
// were completed before processing the file list post-promise
function recursiveFileSync(sftp, files, src, dest) {
    return new Promise((resolve, reject) => {
        try {
            // if the files array is empty, we either never had a list, or we've processed them all
            // close the connection and resolve
            if (files.length <= 0) {
                sftp.end();
                resolve({ success: true });
                return;
            }
            const file = files.pop();
            const sftpPath = `${src}/${file.name}`;
            const localPath = `${dest}/${file.name}`;
            sftp.fastGet(sftpPath, localPath)
                .then(function(res) {
                    if (!res) {
                        error = `Error retrieving file ${sftpPath}`;
                        return next({ error });
                    }
                    return recursiveFileSync(sftp, files, src, dest);
                })
                .then(resolve)
                .catch(err => {
                    sftp.end();
                    printFuncError('recursiveFileSync - fastGet', err);
                    reject(err);
                });
        } catch (err) {
            sftp.end();
            reject(err);
        }
    });
}

// To prevent double-counting with file uploads from client, sync against local directory,
// mv files to processing, sync local directory against sftp directory
export function markFileAsProcessing(localFilePath, file) {
    const sftp = new client();
    return new Promise((resolve, reject) => {
        //Copy file to SFTP processing directory, then remove from the original source such that it isn't processed again in the future
        sftp.connect(connectionConfig)
            .then(() => {
                //move processed file to 'processing' location in sftp [SFTP_ROOT/processing]
                return sftp.put(localFilePath, `${SFTP_IN_ENDPOINT}/processing/${file}`);
            })
            .then(() => {
                // remove original files from [SFTP_ROOT], which is the only directory processed
                return sftp.delete(`${SFTP_IN_ENDPOINT}/${file}`);
            })
            .then(() => sftp.end())
            .then(resolve)
            .catch(err => {
                // need to always close connection, even on error
                sftp.end();
                reject(err);
            });
    });
}
