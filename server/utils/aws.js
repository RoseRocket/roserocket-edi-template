import { format } from 'util';
import { exec } from 'child_process';
const { AWS_IN_ENDPOINT } = process.env;
const CMDS = {
    copy: 'aws s3 cp %s %s',
    sync: 'aws s3 sync %s %s %s',
    rm: 'aws s3 rm %s',
};

//Copy files to/from AWS S3 Bucket
export function fileCopy(src, dest) {
    return new Promise((resolve, reject) => {
        const cmd = format(CMDS.copy, src, dest);
        console.log(cmd);
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (stderr) return reject(stderr);
            resolve(stdout);
        });
    });
}

//Remove files from AWS S3 Bucket
export function fileRemove(src) {
    return new Promise((resolve, reject) => {
        const cmd = format(CMDS.rm, src);
        console.log(cmd);
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (stderr) return reject(stderr);
            resolve(stdout);
        });
    });
}

//Sync local directory to/from AWS, with option to clear out missing files
export function fileSync(src, dest, clean) {
    return new Promise((resolve, reject) => {
        const cmd = format(CMDS.sync, src, dest, clean ? '--delete' : '');
        //cmd = `aws s3 sync ${src} ${dest}`; // useful in local dev if you don't want to keep uploading files to AWS environments
        console.log(cmd);
        exec(cmd, (err, stdout, stderr) => {
            if (err) return reject(err);
            if (stderr) return reject(stderr);
            resolve(stdout);
        });
    });
}

// To prevent double-counting with file uploads from client, sync against local directory, mv files to processing, sync local directory against s3 bucket with --delete
export function markFileAsProcessing(localFilePath, file) {
    return new Promise((resolve, reject) => {
        const awsFilePath = `${AWS_IN_ENDPOINT}processing/${file}`;

        //Copy file to AWS processing directory, then remove from the original source such that it isn't processed again in the future
        fileCopy(localFilePath, awsFilePath)
            .then(res1 => fileRemove(`${AWS_IN_ENDPOINT}${file}`))
            .then(resolve)
            .catch(reject);
        return;
    });
}
