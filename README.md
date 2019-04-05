# roserocket-edi-template

> Boilerplate for webhooks and manual execution of JSON data => EDI File and vice-versa.

## Create environment variable

```
cp .env.example .env
```

## Error logging

Server Errors are currently manually configured to write out to the LOG_DIRECTORY as stipulated by
the environment file. Please make sure that this file has proper permissions for writing.

## Setup company instructions

Create your instructions using https://ediplayground.roserocket.com, and test to see if it's working
properly. Examples are provided, and this project is currently set up to communicate with Roserocket
if you'd like to see what an example set of incoming data looks like (although that's also provided
on the site listed above).

You can save the resulting JSON object to a file in the following directory.
```
$ [PROJECT_ROOT_DIRECTORY]/instructions.
```
The naming convention for instructions should match the following

```
204_in_instructions.txt <===== reading EDI files and converting to JSON data
204_out_instructions.txt <===== reading JSON data and converting it into an EDI file
```

## How to build:

1.  Install Node
2.  Install NPM

To install packages

```
npm install
```

## To build & start webservices, or to manually run the suite

```
npm start
```

OR

```
npm run cli [filename] [data/edi] [204/214/990] [in/out]
// This will look for a filename in the configured data/in or edi/in directories
```
## CRON/automatic reader

```
npm run cronjob
// This will look for all files in the configured data/in or edi/in directories, and can also be
// set up to use AWS S3 buckets
```
## Endpoints:

Generating EDI file from webhooks:

```
http://localhost:5100/v1/webhooks/order/dispatched?token=[CONFIGURED_API_TOKEN]
```

## AWS S3 Bucket Support

This application uploads files to the S3 bucket via AWS CLI. <br />By installing this on the server,
file uploads are accomplished easily via `exec`.

Please follow the AWS-CLI install instructions from: <br />
https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html

Hopefully you won't need it, but the following thread also proved useful when faced with install
errors:<br/> https://forums.aws.amazon.com/thread.jspa?threadID=284473

Finally, once `aws --version` returns a proper response, you can configure the interface to your
account credentials, giving secure access to your S3 bucket.

```
$ aws configure
AWS Access Key ID [None]: [AA_AWS_ACCESS_KEY]
AWS Secret Access Key [None]: [AA_AWS_SECRET_ACCESS_KEY]
Default region name [None]: us-west-2
Default output format [None]: json
```


## License

MIT license;
