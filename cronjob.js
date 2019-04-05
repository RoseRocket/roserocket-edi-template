'use strict';

/* global require */

require('dotenv').config();
require('babel-polyfill');
require('./server-dist/routes/cronjob.js');
