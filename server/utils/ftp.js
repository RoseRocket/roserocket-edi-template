import of from 'await-of';
import PromiseFtp from 'promise-ftp';
import path from 'path';
import { printFuncLog,printFuncError, checkDirectoryStatus } from '../utils/utils';

const {
    FTP_IN_ENDPOINT,
    FTP_OUT_ENDPOINT,
    FTP_HOST,
    FTP_PORT,
    FTP_USERNAME,
    FTP_PASSWORD,
} = process.env;

const connectionConfig = {
    host: FTP_HOST,
    port: FTP_PORT,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
};

export function getFTPFilePath(src = '', dest = '') {
    const filename = `/${path.basename(src)}`;
    return dest + filename;
}

//Copy files to/from FTP location
export function fileCopy(src, dest) {
    const location = getFTPFilePath(src, dest);
    const ftp = new PromiseFtp();
    return new Promise((resolve, reject) => {
        ftp.connect(connectionConfig)
            .then(() => ftp.ascii())
            .then(() => ftp.put(src, location))
		.then(res => {
			printFuncLog("fileCopy",res);
			ftp.end();
                })
            .then(resolve)
            .catch(err => {
                ftp.end();
                reject(err);
            });
    });
}

//Sync FTP to local sync directory
export async function fileSyncFromFTP(src, dest) {
    const ftp = new PromiseFtp(connectionConfig);
    try {
        checkDirectoryStatus(dest);
        let [res, err] = await of(ftp.connect(connectionConfig));
        if (err) {
            ftp.end();
            throw `FTP connection issue: ${err}`;
        }

        [res, err] = await of(ftp.list(src));
        if (err) {
            ftp.end();
            throw `FTP connection issue: ${err}`;
        }

        const files = res.filter(file => file.type != 'd');
        for (const file of files) {
            console.log(file);
            const ftpPath = `${src}/${file.name}`;
            const localPath = `${dest}/${file.name}`;
            // let [, err] = await of(ftp.get(ftpPath, localPath));
            if (err) {
                ftp.end();
                throw 'FTP File retrieval error';
            }
        }
        ftp.end();
        return { success: true };
    } catch (err) {
        ftp.end();
        throw err;
    }
}

// To prevent double-counting with file uploads from client, sync against local directory,
// mv files to processing, sync local directory against sftp directory
export function markFileAsProcessing(localFilePath, file) {
    const ftp = new client();
    return new Promise((resolve, reject) => {
        //Copy file to FTP processing directory, then remove from the original source such that it isn't processed again in the future
        ftp.connect(connectionConfig)
            // **** OPTION START -- REMOVE FOLLOWING LINE IF WE CAN'T BACKUP FROM FTP SOURCE
            //move processed file to 'processing' location in sftp [FTP_ROOT/processing]
            .then(() => ftp.put(localFilePath, `${FTP_IN_ENDPOINT}/processing/${file}`))
            // **** IMPORTANT - remove original files from [FTP_ROOT], to prevent double processing
            .then(() => ftp.delete(`${FTP_IN_ENDPOINT}/${file}`))
            .then(() => ftp.end())
            .then(resolve)
            .catch(err => {
                // need to always close connection, even on error
                ftp.end();
                reject(err);
            });
    });
}
