import { baseRequest } from './baseRequest.js';
import { format } from 'util';
import moment from 'moment';
import { printFuncLog } from '../utils/utils';

const {
    BASE_API_URL,
    ISA_COMPANY_NAME,
    ISA_INTERCHANGE_SENDER_ID,
    ISA_INTERCHANGE_RECEIVER_ID,
} = process.env;

export const config = {
    authHeader: 'Authorization',
    tokenType: 'Bearer',
    timeout: 10000,

    urls: {
        orders: '/api/v1/orders',
        customerOrders: '/api/v1/customers/%s/orders',
        customerOrderRevise: '/api/v1/customers/%s/orders/%s/revise',
        customerOrderMarkInTransit: '/api/v1/customers/%s/orders/%s/mark_in_transit',
        customerOrderMarkDelivered: '/api/v1/customers/%s/orders/%s/mark_delivered',
        ediBase: '/api/v2/edi/%s',
        ediCreate: '/api/v2/edi/request',
        ediGetBySequence: '/api/v2/edi/load_sequence?sequence_id=%s',
    },
};

// getOrder will communicate with the RoseRocket System to retrieve Order details by way of the
// orderID provided in the Webhook Request
export function getOrder(token, orderId) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.orders)}/${orderId}`,
    });
}

// getOrderWithSSCC18 will communicate with the RoseRocket System to retrieve Order details by way of the
// orderID provided in the Webhook Request, and include the expected SSCC-18 labels
export function getOrderWithSSCC18(token, orderId) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.orders)}/${orderId}?additional_info=edi`,
    });
}

// getRequestEDITransaction will communicate with the RoseRocket System to retrieve a new set of
// EDI Transaction Data
export function getRequestEDITransaction(token, orders) {
    var ordersData = [];
    var counter = 0;
    for (const order of orders) {
        counter++;
        var o = {
            order_id: order.id,
            transaction_set_number: counter,
        };
        ordersData.push(o);
    }
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${config.urls.ediCreate}`,
        data: { orders: ordersData },
        method: 'post',
    });
}

// getEDIBaseInformationByRequestID will communicate with the RoseRocket System to retrieve the Base
// information required to load an EDI transaction by
export function getEDIBaseInformationByRequestID(token, sequenceId) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.ediGetBySequence, sequenceId)}`,
    });
}

// loadEDITransactionData will communicate with the RoseRocket System to retrieve an existing set of
// EDI Transaction information, base on the data received from getEDIBaseInformationByRequestID
export function loadEDITransactionData(token, gcnId) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.ediBase, gcnId)}`,
    });
}

// updateEDITransactionData will communicate with the RoseRocket System update the information
// for a given EDI transaction. Depending on the nature of the update, this may also include order
// notifications for rejected orders
export function updateEDITransactionData(token, ediGroup) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.ediBase, ediGroup.id)}`,
        data: ediGroup,
        method: 'put',
    });
}

// reviseOrder will communicate with the RoseRocket System to update the order information with
// the appropriate external ID as set by your system
export function reviseOrder(token, customerId, orderId, order) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(config.urls.customerOrderRevise, customerId, orderId)}`,
        data: order,
        method: 'put',
    });
}

// markInTransit will communicate with the RoseRocket System to update the order information with
// the appropriate status
export function markInTransit(token, customerId, orderId, data = {}) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(
            config.urls.customerOrderMarkInTransit,
            customerId,
            orderId
        )}`,
        data,
        method: 'post',
    });
}

// markDelivered will communicate with the RoseRocket System to update the order information with
// the appropriate status
export function markDelivered(token, customerId, orderId, data = {}) {
    return baseRequest({
        timeout: config.timeout,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json;charset=utf-8',
            Authorization: `${config.tokenType} ${token}`,
        },
        url: `${BASE_API_URL}${format(
            config.urls.customerOrderMarkDelivered,
            customerId,
            orderId
        )}`,
        data,
        method: 'post',
    });
}

// generateEdiRequestBody will generate the base request for communications with our EDI integration
// library, as the request body from RoseRocket Webhooks will be missing items expected by our
// 'instructions', particularly those dealing with the ISA Interchange Control Header.
// Our default EDI Instructions also includes the deadline for response, set below as 'respondBy'
export function generateEdiRequestBody(orders, options = {}) {
    // Must responde by 12 hours from now
    const respondBy = moment()
        .add(12, 'hours')
        .toISOString();
    const currentTime = moment().toISOString();
    const gcn = options.groupControlNumber || '0001';
    var edi = {
        companyName: ISA_COMPANY_NAME,
        interchangeSenderId: ISA_INTERCHANGE_SENDER_ID,
        interchangeReceiverId: ISA_INTERCHANGE_RECEIVER_ID,
        groupControlNumber: gcn,
    };

    if (options.segmentTerminator) {
        edi.segmentTerminator = options.segmentTerminator;
    }
    if (options.ediType) {
        edi.transactionSetHeader = `${options.ediType}`;
    }
    if (options.functionalGroupHeader) {
        edi.functionalGroupHeader = `${options.functionalGroupHeader}`;
    }

    if (options.verbose) {
        printFuncLog('generateEdiRequestBody', edi);
    }

    return {
        __edi: edi,
        __vars: {
            ...options.__vars,
            respondBy,
            currentTime,
        },
        orders: orders,
    };
}
