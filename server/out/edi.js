import { printFuncError, printFuncWarning, printFuncLog } from '../utils/utils';
import * as rrapi from '../api/rrApi.js';
import { rrAuthenticate } from '../utils/rrAuthenticate.js';
const { ORG_NAME } = process.env;

const DETAILS_THD_SKU_SEARCH = /THDSKU:[ ]*[0-9]*/g;
const DETAILS_UPC_SEARCH = /UPC:[ ]*[0-9]*/g;
const DETAILS_UNIT_PRICE_SEARCH = /UNITPRICE:[ ]*[0-9.]*/g;
const DETAILS_TAG_REMOVAL = /[A-Z]*:[ ]*/g;

// processOrderForASN will modify the existing order data to make sure that the newly created shipment
// object which meets the requirements laid out by HD. In order to pass validation, we needed to provide functionality
// for multiple POs for a single shipment, even though in practicality this isn't really possible with existing webhooks
// In order to play nice with EDI lib & instructions, we've been forced to use a pattern of the following:
// orders: { shipment: {BASIC_ORDER_DATA, orders: {order1, order2, etc... } } } where BASIC_ORDER_DATA contains
// the shared origin/destination/shipper etc. etc.
export function processOrderForASN(shipmentData = {}, ediGroup = {}) {
    var shipment = { ...shipmentData };
    var orders = shipmentData.orders;
    if (orders.length == 0) {
        return null;
    }

    var hlCounter = 0;
    var totalPcs = 0;
    var results = [];
    shipment.transmissionNum = ++hlCounter;
    shipment.totalPcs = 0;
    shipment.totalWeight = 0;
    shipment.asnNum = `${ediGroup.sequence_id}`;
    shipment.default_weight_unit_id = shipment.default_weight_unit_id.toUpperCase();

    //unnecessary fields, some light cleanup
    delete shipment.commodities;
    delete shipment.accessorials;

    // HD requirements; subsequent requests for an order musts have an alpha character, when re-transmitting
    var ediOrder = ediGroup.orders.find(g => g.order_id == shipment.id);
    if (ediOrder.attempt_number > 1) {
        const conversionCode = (ediOrder.attempt_number - 1) % 26;
        const charCode = String.fromCharCode(97 + conversionCode);
        shipment.ref_num = `${shipment.ref_num}${charCode}`;
        shipment.public_id = `${shipment.public_id}${charCode}`;
        shipment.asnNum = `${shipment.asnNum}${charCode}`;
    }

    for (const order of orders) {
        if (order == null || order.id === undefined || order.commodities === undefined) {
            continue;
        }

        var o = { ...order };

        o.orderNum = ++hlCounter;
        o.totalPcs = 0;
        o.totalWeight = 0;
        o.default_weight_unit_id = o.default_weight_unit_id.toUpperCase();
        if (order.destination.address_book_external_id != '') {
            o.destination.thd_destination_code = 'SN';
        }

        var commodities = [];
        for (const commodity of order.commodities) {
            o.totalPcs += commodity.pieces;

            if (commodity.ucc_128_labels && commodity.ucc_128_labels.length > 0) {
                // Attempt to calculate pcs per pallet/skid
                var skidCounter = 0;
                const pcsPerPallet =
                    commodity.ucc_128_labels.length > 1
                        ? Math.ceil(commodity.pieces / commodity.quantity)
                        : commodity.pieces;
                const pcsRemaining =
                    commodity.ucc_128_labels.length > 1
                        ? commodity.pieces - (commodity.quantity - 1) * pcsPerPallet
                        : commodity.pieces;

                // need a separate commodity entry for each pallet/tare
                for (const label of commodity.ucc_128_labels) {
                    skidCounter++;
                    var c = { ...commodity };
                    //unsetting labels list, and setting an individual label value for the EDIGambit Looper
                    delete c.ucc_128_labels;

                    // Parse additional data for HL Tare block for ASN
                    c.ucc_label = label.replace(/\D/g, '');
                    c.gtin_12 = `${c.description.match(DETAILS_UPC_SEARCH)}`.replace(
                        DETAILS_TAG_REMOVAL,
                        ''
                    );
                    c.thd_sku = `${c.description.match(DETAILS_THD_SKU_SEARCH)}`.replace(
                        DETAILS_TAG_REMOVAL,
                        ''
                    );
                    c.price = `${c.description.match(DETAILS_UNIT_PRICE_SEARCH)}`.replace(
                        DETAILS_TAG_REMOVAL,
                        ''
                    );

                    //Clean description of the ASN tags
                    c.description = c.description
                        .replace(DETAILS_UPC_SEARCH, '')
                        .replace(DETAILS_THD_SKU_SEARCH, '')
                        .replace(DETAILS_UNIT_PRICE_SEARCH, '')
                        .trim();

                    // Pieces are being used as total pieces, not pieces per quantity,
                    // so we need to calculate an even distribution with per tare
                    c.pieces =
                        skidCounter >= commodity.ucc_128_labels.length && pcsRemaining != 0
                            ? pcsRemaining
                            : pcsPerPallet;
                    c.tareNum = ++hlCounter;
                    c.productNum = ++hlCounter;
                    c.quantity = 1;
                    o.totalWeight += commodity.weight;
                    commodities.push(c);
                }
            }
        }

        o.commodities = commodities;
        o.totalWeight = Math.round(o.totalWeight);
        o.totalPcs = Math.round(o.totalPcs);
        shipment.totalWeight += o.totalWeight;
        shipment.totalPcs += o.totalPcs;
        totalPcs += o.totalPcs;
        results.push(o);
    }

    const gcn = `${ediGroup.sequence_id}`;
    shipment.orders = results;
    return {
        shipments: [shipment],
        totalHL: hlCounter,
        totalPcs: totalPcs,
        groupControlNumber: gcn,
    };
}

/// loadEDITransaction will take an auth token and gcnId, and will get the basic information required
// to load the data.  From there, the function will determine if a different authToken (org) is necessary,
// and will attempt to load it such that the call to load EDI by ID will succeed (the wrong auth will
// result in an access denial error)
export async function loadEDITransaction(authToken, gcnId, currentOrgId) {
    return new Promise((resolve, reject) => {
        if (gcnId == '') {
            reject('Could not load GroupControlID');
        }

        rrapi
            .getEDIBaseInformationByRequestID(authToken, gcnId)
            .then(function(res) {
                if (!res) {
                    reject(
                        `EDI Transaction with sequence ID ${gcnId} could not be found for this Org (${ORG_NAME})`
                    );
                    return;
                }

                const { edi_group_id: ediGroupId = '', org_id: orgId = '' } = res;

                if (currentOrgId != orgId) {
                    return rrAuthenticate(orgId)
                        .then(function(res2 = {}) {
                            if (!res2.access_token) {
                                reject(
                                    'Authorization Failed - Check Org credentials in environment settings.'
                                );
                            }
                            authToken = res2.access_token;
                            return { ediGroupId, authToken };
                        })
                        .catch(reject);
                }
                return { ediGroupId, authToken };
            })
            .then(function(res) {
                if (!res) {
                    reject("Couldn't load the right org to access the EDI Transaction");
                }
                const { ediGroupId = '', authToken = '' } = res;
                rrapi
                    .loadEDITransactionData(authToken, ediGroupId)
                    .then(function(res2) {
                        if (!res2) {
                            reject("Couldn't load transaction by ID");
                        }
                        resolve({ ...res2, authToken });
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
}

// recursiveLoadUCCData will load UCC Data for multiple orderIDs, and return it as an order array.
export function recursiveLoadUCCData(authToken, orderIDs = [], orders = []) {
    return new Promise((resolve, reject) => {
        if (orderIDs.length <= 0) {
            resolve({ orders });
            return;
        }
        const orderID = orderIDs.pop();
        rrapi
            .getOrderWithSSCC18(authToken, orderID)
            .then(function(res) {
                if (!res) {
                    error = `Order with ID ${orderID} could not be found for this Org (${ORG_NAME})`;
                    return next({ error });
                }

                orders.push(res.order);
                return recursiveLoadUCCData(authToken, orderIDs, orders);
            })
            .then(resolve)
            .catch(err => {
                printFuncError('recursiveLoadUCCData - GetOrderWithSSCC18', err);
                reject(err);
            });
    });
}