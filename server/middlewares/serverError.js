import { HTTP_CODES } from '../constants/httpStatusCodes.js';
const { HTTP_SERVER_ERROR } = HTTP_CODES;

export default function(err, req, res, next) {
    res.status(HTTP_SERVER_ERROR).json(err);
}
