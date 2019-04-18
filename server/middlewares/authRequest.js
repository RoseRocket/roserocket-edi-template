import unless from 'express-unless';

import { HTTP_CODES } from '../constants/httpStatusCodes.js';
const { HTTP_NOT_AUTHORIZED } = HTTP_CODES;

const { SECRET_NAME, SECRET_VALUE } = process.env;

function validateSecret(secret) {
    // <------- PUT YOUR AUTH LOGIC IN THIS FUNCTION

    return secret === SECRET_VALUE;
}

function middleware(req, res, next) {
    const secret =
        (req.body && req.body[SECRET_NAME]) ||
        (req.query && req.query[SECRET_NAME]) ||
        req.headers[SECRET_NAME];

    if (!secret) {
        res.status(HTTP_NOT_AUTHORIZED);
        res.json({
            status: HTTP_NOT_AUTHORIZED,
            message: 'Invalid Secret',
        });
        return;
    }

    try {
        // Authorize the user to see if s/he can access our resources
        if (!validateSecret(secret)) {
            res.status(HTTP_NOT_AUTHORIZED);
            res.json({
                status: HTTP_NOT_AUTHORIZED,
                message: 'Not Authorized',
            });
            return;
        }

        next(); // To move to next middleware
    } catch (err) {
        next(err); // To move to next error middleware
    }
}

middleware.unless = unless;

export default middleware;
