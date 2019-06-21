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
