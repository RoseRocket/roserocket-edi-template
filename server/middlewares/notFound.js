import { HTTP_CODES } from '../constants/httpStatusCodes.js';
const { HTTP_NOT_FOUND } = HTTP_CODES;

export default function(req, res) {
    res.sendStatus(HTTP_NOT_FOUND);
}
