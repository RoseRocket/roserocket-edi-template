import { baseRequest } from './baseRequest.js';
import { format } from 'util';
import moment from 'moment';

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
export function generateEdiRequestBody(orders) {
    // Must responde by 12 hours from now
    const respondBy = moment()
        .add(12, 'hours')
        .toISOString();
    return {
        __edi: {
            companyName: ISA_COMPANY_NAME,
            interchangeSenderId: ISA_INTERCHANGE_SENDER_ID,
            interchangeReceiverId: ISA_INTERCHANGE_RECEIVER_ID,
        },
        __vars: {
            groupControlNumber: '0001',
            respondBy,
        },
        orders: orders,
    };
}
