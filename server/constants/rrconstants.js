export const ORDER_BILLING_TYPES = {
    prepaid: 'prepaid',
    collect: 'collect',
    thirdparty: 'thirdparty',
};

export const UNIT_WEIGHTS = {
    kg: 'kg',
    lb: 'lb',
};

export const MEASUREMENT_UNIT = {
    cm: 'cm',
    inch: 'inch',
};

// EnvironmentVars are meant to switch the authentication requests such that the right org is used
// when attempting to create/update EDI transactions.  Webhooks require the orgID in the query string,
// and existing EDI transactions must load the basic EDI information to get the OrgID for a transaction
export const ENVIRONMENT_VARS = [
    {
        ID: 'e12ad5e7-1270-461a-8fa5-c42b620c4a3a',
        SUBDOMAIN: 'ttorg',
        TOKEN_FILE: '/tmp/edi/token1.jwt',
        ALLOWED_CUSTOMERS: ['82f60199-4034-4e83-b5e9-c8ae356a4014'],
        CREDENTIALS: {
            USERNAME: 'john@ttorg.com',
            PASSWORD: 'Password',
            CLIENT_ID: '57a5d63f-dd67-45c4-a737-6ae815164b2e',
            CLIENT_SECRET:
                '3n267l1VQKGNbSuJE9fQbzONJAAwdCxmM8BIabKERsUhPNmMmdf2eSJyYtqwcFiUILzXv2fcNIrWO7sToFgoilA0U1WxNeW1gdgUVDsEWJ77aX7tLFJ84qYU6UrN8cte',
        },
    },
    {
        ID: '6d3eedd7-5cb4-4355-973d-4257152230ec',
        SUBDOMAIN: 'myorg',
        TOKEN_FILE: '/tmp/edi/token2.jwt',
        ALLOWED_CUSTOMERS: ['82f60199-4034-4e83-b5e9-c8ae356a4014'],
        CREDENTIALS: {
            USERNAME: 'john@myorg.com',
            PASSWORD: 'Password',
            CLIENT_ID: '510c4452-68b4-40eb-bc80-12ee9e66a9fe',
            CLIENT_SECRET:
                'nfgDsc2WD8F2qNfHK5a84jjJkwzDkh9h2fhfUVuS9jZ8uVbhV3vC5AWX39IVUWSP2NcHciWvqZTa2N95RxRTZHWUsaD6HEdz0ThbXfQ6pYSQ3n267l1VQKGNbSuJE9fQ',
        },
    },
    {
        ID: 'e48fcf0b-4f44-441a-96ec-41b4a4b372ed',
        SUBDOMAIN: 'bret',
        TOKEN_FILE: '/tmp/edi/token3.jwt',
        CREDENTIALS: {
            USERNAME: 'bret.d@roserocket.com',
            PASSWORD: 'password',
            CLIENT_ID: 'b6c3b863-795e-448d-8e27-09ae31a4ab5f',
            CLIENT_SECRET:
                'BpLnfgDsc2WD8F2qNfHK5a84jjJkwzDkh9h2fhfUVuS9jZ8uVbhV3vC5AWX39IVUWSP2NcHciWvqZTa2N95RxRTZHWUsaD6HEdz0ThbXfQ6pYSQ3n267l1VQKGNbSuJE',
        },
    },
];

export const DEFAULT_ENVIRONMENT = '6d3eedd7-5cb4-4355-973d-4257152230ec';
