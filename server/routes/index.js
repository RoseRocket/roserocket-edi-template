import express from 'express';
// import * as basic from './basic.js';
import * as edi from './edi.js';

const router = express.Router();

router.get('/ping', (req, res) => res.json({ message: 'pong' }));

// Basic rendering ----------------------------
// router.get('/home', basic.home);
// router.get('/homeWithPartials', basic.homeWithPartials);
//---------------------------------------------

// API ----------------------------------------
//router.post('/edi/outbound/:ediType', edi.createOutboundEDIFile);
//router.post('/edi/inbound/:ediType', edi.createInboundEDIFile);
//---------------------------------------------

// RR-Webhooks --------------------------------
router.post('/webhooks/order/dispatched', edi.create204FromRoseRocket);
//router.post('/webhooks/outbound/:ediType', edi.exportRR_EDIFile);
//router.post('/webhooks/inbound/:ediType', edi.importRR_EDIFile);
//---------------------------------------------

export default router;
