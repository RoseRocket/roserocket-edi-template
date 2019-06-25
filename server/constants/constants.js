export const COMPANY_TYPES = {
    APPS: 'APPS',
    ANCarrier: 'ANCarrier',
};

export const EDI_TYPES = {
    204: '204',
    214: '214',
    856: '856',
    864: '864',
    990: '990',
    997: '997',
};

// This is a direct mapping from EDI Acknowledgment files to internal data types
export const EDI_997_STATUS_TYPES = {
    A: 'accepted',
    E: 'accepted',
    R: 'declined',
    P: 'partial-acceptance',
};

export const EDI_997_STATUS_DEFAULT_MESSAGES = {
    E: 'Accepted with Errors',
};

export const EDI_867_ERROR_CODES = {
    IB05: 'Store Number (N406) Not a Valid Location',
    IB07: 'PO Number Required Field Missing',
    IB51: 'Zero Line Items on ASN',
    IB57: 'Required CTT Segment Missing',
    IB62: 'Invalid Ship Date',
    J001: 'ASN header passed by no details exist',
    J002: 'DC number blanks',
    J003: 'Invalid DC Number',
    J004: 'Invalid length of PO number',
    J006: 'PO# contains non-numeric characters',
    J008: 'Sending paretner ID is blank',
    J009: 'SKU not found',
    J010: 'SKU not on PO',
    J011: 'No valid ASN detail',
    J012: 'Duplicated POs',
    J016: 'PO failed SKU level Threshold %',
    J018: 'Freight Bill Issue',
    J020: 'Duplicate LPN',
};
