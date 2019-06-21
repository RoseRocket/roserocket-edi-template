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

export const ENVIRONMENT_VARS = [
    {
        ID: 'e12ad5e7-1270-461a-8fa5-c42b620c4a3a',
        SUBDOMAIN: 'ttorg',
        TOKEN_FILE: '/tmp/edi/token1.jwt',
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
        CREDENTIALS: {
            USERNAME: 'john@myorg.com',
            PASSWORD: 'Password',
            CLIENT_ID: '510c4452-68b4-40eb-bc80-12ee9e66a9fe',
            CLIENT_SECRET:
                'nfgDsc2WD8F2qNfHK5a84jjJkwzDkh9h2fhfUVuS9jZ8uVbhV3vC5AWX39IVUWSP2NcHciWvqZTa2N95RxRTZHWUsaD6HEdz0ThbXfQ6pYSQ3n267l1VQKGNbSuJE9fQ',
        },
    },
];

export const DEFAULT_ENVIRONMENT = '6d3eedd7-5cb4-4355-973d-4257152230ec';
