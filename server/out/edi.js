import { printFuncError, printFuncWarning, printFuncLog } from '../utils/utils';
import * as rrapi from '../api/rrApi.js';
import { rrAuthenticate } from '../utils/rrAuthenticate.js';
const { ORG_NAME } = process.env;

export function processOrderForASN(orders = [], ediGroup = {}) {
    if (orders.length == 0) {
        return null;
    }

    var hlCounter = 0;
    var totalPcs = 0;
    var results = [];
    for (const order of orders) {
        if (order == null || order.id === undefined || order.commodities === undefined) {
            continue;
        }

        var o = { ...order };

        o.transmissionNum = ++hlCounter;
        o.orderNum = ++hlCounter;
        o.totalPcs = 0;
        o.totalWeight = 0;
        o.asnNum = `${ediGroup.sequence_id}`;
        o.default_weight_unit_id = o.default_weight_unit_id.toUpperCase();

        // HD requirements; subsequent requests for an order musts have an alpha character, when re-transmitting

        var ediOrder = ediGroup.orders.find(g => g.order_id == o.id);
        if (ediOrder.attempt_number > 1) {
            var charCode = String.fromCharCode(96 + ediOrder.attempt_number);
            o.ref_num = `${o.ref_num}${charCode}`;
            o.public_id = `${o.public_id}${charCode}`;
            o.asnNum = `${o.asnNum}${charCode}`;
        }

        var commodities = [];
        for (const commodity of order.commodities) {
            if (commodity.ucc_128_labels && commodity.ucc_128_labels.length > 0) {
                // need a separate commodity entry for each pallet/tare
                for (const label of commodity.ucc_128_labels) {
                    var c = { ...commodity };
                    //unsetting labels list, and setting an individual label value for the EDIGambit Looper
                    delete c.ucc_128_labels;

                    // set params for HL for ASN
                    c.ucc_label = label.replace(/\D/g, '');
                    //c.gtin_12 = c.gtin_12.replace(/\D/g, '');
                    c.gtin_12 = 'testdata';
                    c.tareNum = ++hlCounter;
                    c.productNum = ++hlCounter;
                    c.quantity = 1;
                    commodities.push(c);

                    // Orders needs to be aware of some commodity totals
                    o.totalPcs += commodity.pieces;
                    o.totalWeight += commodity.weight;
                }
            }
        }
        o.commodities = commodities;
        totalPcs += o.totalPcs;
        results.push(o);
    }

    const gcn = `${ediGroup.sequence_id}`.padStart(6, '0');
    return { orders: results, totalHL: hlCounter, totalPcs: totalPcs, groupControlNumber: gcn };
}

/// loadEDITransaction will take an auth token and gcnId, and will get the basic infromation required
// to load the data.  From there, the function will determine if a different authToken is necessary,
// and will attempt to load it such that the call to load EDI by ID will success (the wrong auth will
// result in an access denied error)
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

//recursiveLoadUCCData will load UCC Data for multiple orderIDs
export async function recursiveLoadUCCData(authToken, orderIDs = [], orders = []) {
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
