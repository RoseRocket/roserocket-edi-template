# Roserocket EDI Playground

> This is an online integration point to convert EDI (Electronic Data Inerchange) files to data and
> vice-versa, given a strict set of parsing instructions. If this is your first foray into EDI files,
> you may find some of the following resources useful in understanding the overall structure.
> <br /> <br />
> As this is a guide to supplement our online EDI Library, it's recommended that you have it open
> and try to read along with the instructions with various examples to see how it all fits together.
> <br /> <br />

You may find the following resources useful: <br />
https://ediplayground.roserocket.com <br />
https://docs.oracle.com/cd/E19398-01/820-1275/agdaw/index.html <br />
https://www.spscommerce.com/resources/edi-documents-transactions/

## Environment and Setup

This online tool can be accessed using the following information:

```
URL: https://ediplayground.roserocket.com
Access Token: 9cd41350-5322-474b-aeba-1aa71b7708a2      (open access,throttled)
```

### API Endpoints
With the above information, POST requests can be made to either read a provided EDI file, or
convert a JSON object into an EDI file

EDI File => JSON Data: https://ediplayground.roserocket.com/v1/edi/read <br />
JSON Data => EDI File: https://ediplayground.roserocket.com/v1/edi/write

### General Authentication
The EDI Library is expecting an authorized _Access Token_, which you will need to use to access.
While the playground access token is available, it is being monitored and can potentially be IP restricted
if it's used by any third party with malicious intent; as such, it is recommended that you use your
assiged access token to prevent future potential breakdown in the event that the access token
becomes restricted or even outright banned.

Below, you can see the JSON object that is passed into Ajax request headers to access the EDI Library

```
{
    'Accept': 'application/json',
    'Content-Type': 'application/json;charset=utf-8',
    'access-token': EDI_ACCESS_TOKEN
}
```

# Instructions Implementation
As you are most likely already aware, EDI (Electronic Data Inerchange) files are interface agreements
that electronic systems can use to transfer data between existing systems. Their formats adhere to a
strict set of implementations (with some minor customization) to improve speed and accuracy of transfers.

In the files linked below, we'll illustrate how to setup a configuration for the Online EDI Library
such that it can interpret any data you send to the playground and output a desired result, whether
it be the generation of an EDI file given a data object, or the data within an EDI file to be processed
by your system.

Every line, or **_'segment'_**, in an EDI file contains a meaningful set of **_'elements'_** that can be
uniquely interpreted. Understanding each segment, how they relate to one another, and most importantly,
how to make the EDI Library understand, group, and read/write these segments is the purpose of this document.

## Reading an existing EDI file
The guidelines for reading an existing EDI File can be found <a href='./EDI_Library_Read.md' target="_blank">here</a>.

## Creating a new EDI file
The guidelines for creating a new EDI File can be found <a href='./EDI_Library_Write.md' target="_blank">here</a>.
