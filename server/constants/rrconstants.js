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
        ID: 'f91499eb-1dc1-47a7-abe7-a19c6a98c44e',
        SUBDOMAIN: 'gfnorfolk',
        TOKEN_FILE: '/tmp/edi/token10.jwt',
        ALLOWED_CUSTOMERS_856: [
            '6fbb4021-2fb0-4fb9-8c8e-257f676d8804',
            'bc0bf44a-22ab-4130-af53-842b1b714058',
            'fakeID',
        ],
        CREDENTIALS: {
            USERNAME: 'admin+gfnorfolk@roserocket.com',
            PASSWORD: 'trailmix',
            CLIENT_ID: '3f834e87-1b22-4f60-aa4a-fa31011f5677',
            CLIENT_SECRET:
                'JxUHuncgES5Mxqqfr7HCeLO2BO4bNtIaXfjvSakbJULePfx1sAXbOGK4eipINQ2KcqNqPUZwKCYh9vZq4MfJoonAba8e80Hm09Hut1OY1FMbawm2rgaToUPHI0L9ssCC',
        },
    },
    //************************  LOCAL DEV ENVIRONMENT VARS START *************************************
    {
        ID: 'e12ad5e7-1270-461a-8fa5-c42b620c4a3a',
        SUBDOMAIN: 'ttorg',
        TOKEN_FILE: '/tmp/edi/token1.jwt',
        ALLOWED_CUSTOMERS_856: ['82f60199-4034-4e83-b5e9-c8ae356a4014', 'fakeID'],
        CREDENTIALS: {
            USERNAME: 'john@ttorg.com',
            PASSWORD: 'Password',
            CLIENT_ID: '57a5d63f-dd67-45c4-a737-6ae815164b2e',
            CLIENT_SECRET:
                '3n267l1VQKGNbSuJE9fQbzONJAAwdCxmM8BIabKERsUhPNmMmdf2eSJyYtqwcFiUILzXv2fcNIrWO7sToFgoilA0U1WxNeW1gdgUVDsEWJ77aX7tLFJ84qYU6UrN8cte',
        },
    },
    {
        ID: 'e48fcf0b-4f44-441a-96ec-41b4a4b372ed',
        SUBDOMAIN: 'bret',
        TOKEN_FILE: '/tmp/edi/token3.jwt',
        ALLOWED_CUSTOMERS_856: ['82f60199-4034-4e83-b5e9-c8ae356a4014'],
        CREDENTIALS: {
            USERNAME: 'bret.d@roserocket.com',
            PASSWORD: 'password',
            CLIENT_ID: 'b6c3b863-795e-448d-8e27-09ae31a4ab5f',
            CLIENT_SECRET:
                'BpLnfgDsc2WD8F2qNfHK5a84jjJkwzDkh9h2fhfUVuS9jZ8uVbhV3vC5AWX39IVUWSP2NcHciWvqZTa2N95RxRTZHWUsaD6HEdz0ThbXfQ6pYSQ3n267l1VQKGNbSuJE',
        },
    },
    //************************  LOCAL DEV ENVIRONMENT VARS END *************************************
];

export const DEFAULT_ENVIRONMENT = 'e12ad5e7-1270-461a-8fa5-c42b620c4a3a';
