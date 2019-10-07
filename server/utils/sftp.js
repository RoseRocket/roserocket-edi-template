import of from 'await-of';
import client from 'ssh2-sftp-client';
import path from 'path';
import { printFuncError, checkDirectoryStatus } from '../utils/utils';
const { SFTP_IN_ENDPOINT, SFTP_HOST, SFTP_PORT, SFTP_USERNAME, SFTP_PASSWORD } = process.env;

const connectionConfig = {
    host: SFTP_HOST,
    port: SFTP_PORT,
    username: SFTP_USERNAME,
    password: SFTP_PASSWORD,
    //privateKey: require('fs').readFileSync('/route/to/private/key')
};

// Unlike AWS and local file copy, SFTP requires the target file name
// This additional function will include the generated filename in the target path
export function getSFTPFilePath(src = '', dest = '') {
    const filename = `/${path.basename(src)}`;
    return dest + filename;
}

//Copy files to/from SFTP location
export function fileCopy(src, dest) {
    const sftp = new client();
    return new Promise((resolve, reject) => {
        sftp.connect(connectionConfig)
            .then(() => sftp.put(src, getSFTPFilePath(src, dest)))
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
export async function fileSyncFromSFTP(src, dest) {
    const sftp = new client();
    try {
        checkDirectoryStatus(dest);
        let [res, err] = await of(sftp.connect(connectionConfig));
        if (err) {
            sftp.end();
            throw `SFTP connection issue: ${err}`;
        }

        [res, err] = await of(sftp.list(src));
        if (err) {
            sftp.end();
            throw `SFTP connection issue: ${err}`;
        }

        const files = res.filter(file => file.type != 'd');
        for (const file of files) {
            const sftpPath = `${src}/${file.name}`;
            const localPath = `${dest}/${file.name}`;
            let [, err] = await of(sftp.fastGet(sftpPath, localPath));
            if (err) {
                sftp.end();
                throw 'SFTP File retrieval error';
            }
        }
        sftp.end();
        return { success: true };
    } catch (err) {
        sftp.end();
        throw err;
    }
}

// To prevent double-counting with file uploads from client, sync against local directory,
// mv files to processing, sync local directory against sftp directory
export function markFileAsProcessing(localFilePath, file) {
    const sftp = new client();
    return new Promise((resolve, reject) => {
        //Copy file to SFTP processing directory, then remove from the original source such that it isn't processed again in the future
        sftp.connect(connectionConfig)
            // **** OPTION START -- REMOVE FOLLOWING LINE IF WE CAN'T BACKUP FROM SFTP SOURCE
            //move processed file to 'processing' location in sftp [SFTP_ROOT/processing]
            .then(() => sftp.put(localFilePath, `${SFTP_IN_ENDPOINT}/processing/${file}`))
            // **** IMPORTANT - remove original files from [SFTP_ROOT], to prevent double processing
            .then(() => sftp.delete(`${SFTP_IN_ENDPOINT}/${file}`))
            .then(() => sftp.end())
            .then(resolve)
            .catch(err => {
                // need to always close connection, even on error
                sftp.end();
                reject(err);
            });
    });
}
