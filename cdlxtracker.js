if (typeof _cdlxmain !== 'object') {
    _cdlxmain = [];
}
// Cdlx singleton and namespace
if (typeof window.Cdlx !== 'object') {
    window.Cdlx = (function () {
        // 'use strict';

        //variables declaration
        var expireDateTime,

            /* plugins */
            plugins = {},

            eventHandlers = {},

            /* alias frequently used globals for added minification */
            documentAlias = document,
            navigatorAlias = navigator,
            screenAlias = screen,
            windowAlias = window,

            /* performance timing */
            performanceAlias = windowAlias.performance || windowAlias.mozPerformance || windowAlias.msPerformance || windowAlias.webkitPerformance,

            /* encode */
            encodeWrapper = windowAlias.encodeURIComponent,

            /* decode */
            decodeWrapper = windowAlias.decodeURIComponent,


            /* asynchronous tracker */
            asyncTrackers = [],

            /* iterator */
            iterator,

            /* local Cdlx */
            Cdlx,

            missedPluginTrackerCalls = [],

            coreConsentCounter = 0,

            trackerIdCounter = 0,

            isPageUnloading = false;

        //utilities
        var content = {};
        function safeDecodeWrapper(url) {
            try {
                return decodeWrapper(url);
            } catch (e) {
                return unescape(url);
            }
        }
        function isDefined(property) {
            var propertyType = typeof property;

            return propertyType !== 'undefined';
        }

        function isFunction(property) {
            return typeof property === 'function';
        }
        function isObject(property) {
            return typeof property === 'object';
        }

        function isString(property) {
            return typeof property === 'string' || property instanceof String;
        }

        function isNumber(property) {
            return typeof property === 'number' || property instanceof Number;
        }

        function isNumberOrHasLength(property) {
            return isDefined(property) && (isNumber(property) || (isString(property) && property.length));
        }

        function isObjectEmpty(property) {
            if (!property) {
                return true;
            }

            var i;
            var isEmpty = true;
            for (i in property) {
                if (Object.prototype.hasOwnProperty.call(property, i)) {
                    isEmpty = false;
                }
            }

            return isEmpty;
        }
        function logConsoleError(message) {
            // needed to write it this way for jslint
            var consoleType = typeof console;
            if (consoleType !== 'undefined' && console && console.error) {
                console.error(message);
            }
        }
        function apply() {
            var i, j, f, parameterArray, trackerCall;

            for (i = 0; i < arguments.length; i += 1) {
                trackerCall = null;
                if (arguments[i] && arguments[i].slice) {
                    trackerCall = arguments[i].slice();
                }
                parameterArray = arguments[i];
                f = parameterArray.shift();

                var fParts, context;

                var isStaticPluginCall = isString(f) && f.indexOf('::') > 0;
                if (isStaticPluginCall) {
                    // a static method will not be called on a tracker and is not dependent on the existence of a
                    // tracker etc
                    fParts = f.split('::');
                    context = fParts[0];
                    f = fParts[1];

                    if ('object' === typeof Cdlx[context] && 'function' === typeof Cdlx[context][f]) {
                        Cdlx[context][f].apply(Cdlx[context], parameterArray);
                    } else if (trackerCall) {
                        missedPluginTrackerCalls.push(trackerCall);
                    }

                } else {
                    for (j = 0; j < asyncTrackers.length; j++) {
                        if (isString(f)) {
                            context = asyncTrackers[j];

                            var isPluginTrackerCall = f.indexOf('.') > 0;

                            if (isPluginTrackerCall) {
                                fParts = f.split('.');
                                if (context && 'object' === typeof context[fParts[0]]) {
                                    context = context[fParts[0]];
                                    f = fParts[1];
                                } else if (trackerCall) {
                                    // we try to call that method again later as the plugin might not be loaded yet
                                    missedPluginTrackerCalls.push(trackerCall);
                                    break;
                                }
                            }

                            if (context[f]) {
                                context[f].apply(context, parameterArray);
                            } else {
                                var message = 'The method \'' + f + '\' was not found in "_cdlxmain" variable.';
                                logConsoleError(message);

                                if (!isPluginTrackerCall) {
                                    throw new TypeError(message);
                                }
                            }

                            if (f === 'addTracker') {
                                // addTracker adds an entry to asyncTrackers and would otherwise result in an endless loop
                                break;
                            }

                            if (f === 'setTrackerUrl' || f === 'setSiteId') {
                                // these two methods should be only executed on the first tracker
                                break;
                            }
                        } else {
                            f.apply(asyncTrackers[j], parameterArray);
                        }
                    }
                }
            }
        }

        /*
         * Cross-browser helper function to add event handler
         */
        function addEventListener(element, eventType, eventHandler, useCapture) {
            if (element.addEventListener) {
                element.addEventListener(eventType, eventHandler, useCapture);

                return true;
            }

            if (element.attachEvent) {
                return element.attachEvent('on' + eventType, eventHandler);
            }

            element['on' + eventType] = eventHandler;
        }

        function trackCallbackOnLoad(callback) {
            if (documentAlias.readyState === 'complete') {
                callback();
            } else if (windowAlias.addEventListener) {
                windowAlias.addEventListener('load', callback, false);
            } else if (windowAlias.attachEvent) {
                windowAlias.attachEvent('onload', callback);
            }
        }
        function trackCallbackOnReady(callback) {
            var loaded = false;

            if (documentAlias.attachEvent) {
                loaded = documentAlias.readyState === 'complete';
            } else {
                loaded = documentAlias.readyState !== 'loading';
            }

            if (loaded) {
                callback();
                return;
            }

            var _timer;

            if (documentAlias.addEventListener) {
                addEventListener(documentAlias, 'DOMContentLoaded', function ready() {
                    documentAlias.removeEventListener('DOMContentLoaded', ready, false);
                    if (!loaded) {
                        loaded = true;
                        callback();
                    }
                });
            } else if (documentAlias.attachEvent) {
                documentAlias.attachEvent('onreadystatechange', function ready() {
                    if (documentAlias.readyState === 'complete') {
                        documentAlias.detachEvent('onreadystatechange', ready);
                        if (!loaded) {
                            loaded = true;
                            callback();
                        }
                    }
                });

                if (documentAlias.documentElement.doScroll && windowAlias === windowAlias.top) {
                    (function ready() {
                        if (!loaded) {
                            try {
                                documentAlias.documentElement.doScroll('left');
                            } catch (error) {
                                setTimeout(ready, 0);

                                return;
                            }
                            loaded = true;
                            callback();
                        }
                    }());
                }
            }

            // fallback
            addEventListener(windowAlias, 'load', function () {
                if (!loaded) {
                    loaded = true;
                    callback();
                }
            }, false);
        }
        function getReferrer() {
            var referrer = '';

            try {
                referrer = windowAlias.top.document.referrer;
            } catch (e) {
                if (windowAlias.parent) {
                    try {
                        referrer = windowAlias.parent.document.referrer;
                    } catch (e2) {
                        referrer = '';
                    }
                }
            }

            if (referrer === '') {
                referrer = documentAlias.referrer;
            }

            return referrer;
        }

        /*
         * Extract scheme/protocol from URL
         */
        function getProtocolScheme(url) {
            var e = new RegExp('^([a-z]+):'),
                matches = e.exec(url);

            return matches ? matches[1] : null;
        }

        /*
         * Extract hostname from URL
         */
        function getHostName(url) {
            // scheme : // [username [: password] @] hostame [: port] [/ [path] [? query] [# fragment]]
            var e = new RegExp('^(?:(?:https?|ftp):)/*(?:[^@]+@)?([^:/#]+)'),
                matches = e.exec(url);

            return matches ? matches[1] : url;
        }
        function stringStartsWith(str, prefix) {
            str = String(str);
            return str.lastIndexOf(prefix, 0) === 0;
        }

        function stringEndsWith(str, suffix) {
            str = String(str);
            return str.indexOf(suffix, str.length - suffix.length) !== -1;
        }
        function removeUrlParameter(url, name) {
            url = String(url);

            if (url.indexOf('?' + name + '=') === -1 && url.indexOf('&' + name + '=') === -1) {
                return url;
            }

            var searchPos = url.indexOf('?');
            if (searchPos === -1) {
                return url;
            }

            var queryString = url.substr(searchPos + 1);
            var baseUrl = url.substr(0, searchPos);

            if (queryString) {
                var urlHash = '';
                var hashPos = queryString.indexOf('#');
                if (hashPos !== -1) {
                    urlHash = queryString.substr(hashPos + 1);
                    queryString = queryString.substr(0, hashPos);
                }

                var param;
                var paramsArr = queryString.split('&');
                var i = paramsArr.length - 1;

                for (i; i >= 0; i--) {
                    param = paramsArr[i].split('=')[0];
                    if (param === name) {
                        paramsArr.splice(i, 1);
                    }
                }

                var newQueryString = paramsArr.join('&');

                if (newQueryString) {
                    baseUrl = baseUrl + '?' + newQueryString;
                }

                if (urlHash) {
                    baseUrl += '#' + urlHash;
                }
            }

            return baseUrl;
        }

        /*
         * Extract parameter from URL
         */
        function getUrlParameter(url, name) {
            var regexSearch = "[\\?&#]" + name + "=([^&#]*)";
            var regex = new RegExp(regexSearch);
            var results = regex.exec(url);
            return results ? decodeWrapper(results[1]) : '';
        }

        function trim(text) {
            if (text && String(text) === text) {
                return text.replace(/^\s+|\s+$/g, '');
            }

            return text;
        }

        /*
         * UTF-8 encoding
         */
        function utf8_encode(argString) {
            return unescape(encodeWrapper(argString));
        }
        function sha1(str) {
            var
                rotate_left = function (n, s) {
                    return (n << s) | (n >>> (32 - s));
                },

                cvt_hex = function (val) {
                    var strout = '',
                        i,
                        v;

                    for (i = 7; i >= 0; i--) {
                        v = (val >>> (i * 4)) & 0x0f;
                        strout += v.toString(16);
                    }

                    return strout;
                },

                blockstart,
                i,
                j,
                W = [],
                H0 = 0x67452301,
                H1 = 0xEFCDAB89,
                H2 = 0x98BADCFE,
                H3 = 0x10325476,
                H4 = 0xC3D2E1F0,
                A,
                B,
                C,
                D,
                E,
                temp,
                str_len,
                word_array = [];

            str = utf8_encode(str);
            str_len = str.length;

            for (i = 0; i < str_len - 3; i += 4) {
                j = str.charCodeAt(i) << 24 | str.charCodeAt(i + 1) << 16 |
                    str.charCodeAt(i + 2) << 8 | str.charCodeAt(i + 3);
                word_array.push(j);
            }

            switch (str_len & 3) {
                case 0:
                    i = 0x080000000;
                    break;
                case 1:
                    i = str.charCodeAt(str_len - 1) << 24 | 0x0800000;
                    break;
                case 2:
                    i = str.charCodeAt(str_len - 2) << 24 | str.charCodeAt(str_len - 1) << 16 | 0x08000;
                    break;
                case 3:
                    i = str.charCodeAt(str_len - 3) << 24 | str.charCodeAt(str_len - 2) << 16 | str.charCodeAt(str_len - 1) << 8 | 0x80;
                    break;
            }

            word_array.push(i);

            while ((word_array.length & 15) !== 14) {
                word_array.push(0);
            }

            word_array.push(str_len >>> 29);
            word_array.push((str_len << 3) & 0x0ffffffff);

            for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
                for (i = 0; i < 16; i++) {
                    W[i] = word_array[blockstart + i];
                }

                for (i = 16; i <= 79; i++) {
                    W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
                }

                A = H0;
                B = H1;
                C = H2;
                D = H3;
                E = H4;

                for (i = 0; i <= 19; i++) {
                    temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
                    E = D;
                    D = C;
                    C = rotate_left(B, 30);
                    B = A;
                    A = temp;
                }

                for (i = 20; i <= 39; i++) {
                    temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
                    E = D;
                    D = C;
                    C = rotate_left(B, 30);
                    B = A;
                    A = temp;
                }

                for (i = 40; i <= 59; i++) {
                    temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
                    E = D;
                    D = C;
                    C = rotate_left(B, 30);
                    B = A;
                    A = temp;
                }

                for (i = 60; i <= 79; i++) {
                    temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
                    E = D;
                    D = C;
                    C = rotate_left(B, 30);
                    B = A;
                    A = temp;
                }

                H0 = (H0 + A) & 0x0ffffffff;
                H1 = (H1 + B) & 0x0ffffffff;
                H2 = (H2 + C) & 0x0ffffffff;
                H3 = (H3 + D) & 0x0ffffffff;
                H4 = (H4 + E) & 0x0ffffffff;
            }

            temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);

            return temp.toLowerCase();
        }

        function urlFixup(hostName, href, referrer) {
            if (!hostName) {
                hostName = '';
            }

            if (!href) {
                href = '';
            }

            if (hostName === 'translate.googleusercontent.com') {       // Google
                if (referrer === '') {
                    referrer = href;
                }

                href = getUrlParameter(href, 'u');
                hostName = getHostName(href);
            } else if (hostName === 'cc.bingj.com' ||                   // Bing
                hostName === 'webcache.googleusercontent.com' ||    // Google
                hostName.slice(0, 5) === '74.6.') {                 // Yahoo (via Inktomi 74.6.0.0/16)
                href = documentAlias.links[0].href;
                hostName = getHostName(href);
            }

            return [hostName, href, referrer];
        }
        function domainFixup(domain) {
            var dl = domain.length;

            // remove trailing '.'
            if (domain.charAt(--dl) === '.') {
                domain = domain.slice(0, dl);
            }

            // remove leading '*'
            if (domain.slice(0, 2) === '*.') {
                domain = domain.slice(1);
            }

            if (domain.indexOf('/') !== -1) {
                domain = domain.substr(0, domain.indexOf('/'));
            }

            return domain;
        }
        function titleFixup(title) {
            title = title && title.text ? title.text : title;

            if (!isString(title)) {
                var tmp = documentAlias.getElementsByTagName('title');

                if (tmp && isDefined(tmp[0])) {
                    title = tmp[0].text;
                }
            }

            return title;
        }

        //Tracker function
        function Tracker(trackerUrl, siteId) {
            var
                trackerInstance = this,

                // constants
                CONSENT_COOKIE_NAME = 'mtm_consent',
                CONSENT_REMOVED_COOKIE_NAME = 'mtm_consent_removed',

                // Current URL and Referrer URL
                locationArray = urlFixup(documentAlias.domain, windowAlias.location.href, getReferrer()),
                domainAlias = domainFixup(locationArray[0]),
                locationHrefAlias = safeDecodeWrapper(locationArray[1]),
                configReferrerUrl = safeDecodeWrapper(locationArray[2]),

                enableJSErrorTracking = false,

                defaultRequestMethod = 'GET',

                // Request method (GET or POST)
                configRequestMethod = defaultRequestMethod,

                defaultRequestContentType = 'application/x-www-form-urlencoded; charset=UTF-8',

                // Request Content-Type header value; applicable when POST request method is used for submitting tracking events
                configRequestContentType = defaultRequestContentType,

                // Tracker URL
                configTrackerUrl = 'https://localhost:5001/api/Tracker',

                // API URL (only set if it differs from the Tracker URL)
                configApiUrl = '',

                // This string is appended to the Tracker URL Request (eg. to send data that is not handled by the existing setters/getters)
                configAppendToTrackingUrl = '',

                // Site ID
                configTrackerSiteId = siteId || '',

                // User ID
                configUserId = '',

                // Visitor UUID
                visitorUUID = '',

                // Document URL
                configCustomUrl,

                // Document title
                configTitle = '',


                // Hosts or alias(es) to not treat as outlinks
                configHostsAlias = [domainAlias],

                lastTrackerRequestTime = null,

                // Maximum delay to wait for web bug image to be fetched (in milliseconds)
                configTrackerPause = 500,



                // Disallow hash tags in URL
                configDiscardHashTag,

                // Custom data
                configCustomData,

                // Campaign names
                configCampaignNameParameters = ['pk_campaign', 'cdlx_campaign', 'utm_campaign', 'utm_source', 'utm_medium'],

                // Campaign keywords
                configCampaignKeywordParameters = ['pk_kwd', 'cdlx_kwd', 'utm_term'],

                // First-party cookie name prefix
                configCookieNamePrefix = '_pk_',
                configVisitorIdUrlParameter = 'pk_vid',

                // Cross domain linking, the visitor ID is transmitted only in the 180 seconds following the click.
                configVisitorIdUrlParameterTimeoutInSeconds = 180,

                // First-party cookie domain
                // User agent defaults to origin hostname
                configCookieDomain,

                // First-party cookie path
                // Default is user agent defined.
                configCookiePath,

                // Whether to use "Secure" cookies that only work over SSL
                configCookieIsSecure = false,

                // First-party cookies are disabled
                configCookiesDisabled = false,

                // Do Not Track
                configDoNotTrack,

                // Count sites which are pre-rendered
                configCountPreRendered,

                // Do we attribute the conversion to the first referrer or the most recent referrer?
                configConversionAttributionFirstReferrer,

                // Life of the visitor cookie (in milliseconds)
                configVisitorCookieTimeout = 33955200000, // 13 months (365 days + 28days)

                // Life of the session cookie (in milliseconds)
                configSessionCookieTimeout = 1800000, // 30 minutes

                // Life of the referral cookie (in milliseconds)
                configReferralCookieTimeout = 15768000000, // 6 months

                // Is performance tracking enabled
                configPerformanceTrackingEnabled = true,

                // Generation time set from the server
                configPerformanceGenerationTime = 0,

                // Whether Custom Variables scope "visit" should be stored in a cookie during the time of the visit
                configStoreCustomVariablesInCookie = false,

                // Custom Variables read from cookie, scope "visit"
                customVariables = false,

                configCustomRequestContentProcessing,

                // Custom Variables, scope "page"
                customVariablesPage = {},

                // Custom Variables, scope "event"
                customVariablesEvent = {},

                // Custom Dimensions (can be any scope)
                customDimensions = {},

                // Custom Variables names and values are each truncated before being sent in the request or recorded in the cookie
                customVariableMaximumLength = 200,


                // Browser features via client-side data collection
                browserFeatures = {},
                timeNextTrackingRequestCanBeExecutedImmediately = false,


                crossDomainTrackingEnabled = false,
                // Hash function
                hash = sha1,

                // Domain hash value
                domainHash,

                configIdPageView,

                // we measure how many pageviews have been tracked so plugins can use it to eg detect if a
                // pageview was already tracked or not
                numTrackedPageviews = 0,

                configCookiesToDelete = ['id', 'ses', 'cvar', 'ref'],

                // whether requireConsent() was called or not
                configConsentRequired = false,
                configHasConsent = null, // initialized below

                // holds all pending tracking requests that have not been tracked because we need consent
                consentRequestsQueue = [],

                // a unique ID for this tracker during this request
                uniqueTrackerId = trackerIdCounter++;

            // Document title
            try {
                configTitle = documentAlias.title;
            } catch (e) {
                configTitle = '';
            }

            /*
             * Set cookie value
             */
            function setCookie(cookieName, value, msToExpire, path, domain, isSecure) {
                if (configCookiesDisabled) {
                    return;
                }

                var expiryDate;

                // relative time to expire in milliseconds
                if (msToExpire) {
                    expiryDate = new Date();
                    expiryDate.setTime(expiryDate.getTime() + msToExpire);
                }

                documentAlias.cookie = cookieName + '=' + encodeWrapper(value) +
                    (msToExpire ? ';expires=' + expiryDate.toGMTString() : '') +
                    ';path=' + (path || '/') +
                    (domain ? ';domain=' + domain : '') +
                    (isSecure ? ';secure' : '');
            }

            /*
             * Get cookie value
             */
            function getCookie(cookieName) {
                if (configCookiesDisabled) {
                    return 0;
                }

                var cookiePattern = new RegExp('(^|;)[ ]*' + cookieName + '=([^;]*)'),
                    cookieMatch = cookiePattern.exec(documentAlias.cookie);

                return cookieMatch ? decodeWrapper(cookieMatch[2]) : 0;
            }

            configHasConsent = !getCookie(CONSENT_REMOVED_COOKIE_NAME);

            function purify(url) {
                var targetPattern;

                // we need to remove this parameter here, they wouldn't be removed in Cdlx tracker otherwise eg
                // for outlinks or referrers
                url = removeUrlParameter(url, configVisitorIdUrlParameter);

                if (configDiscardHashTag) {
                    targetPattern = new RegExp('#.*');

                    return url.replace(targetPattern, '');
                }

                return url;
            }

            /*
             * Resolve relative reference
             *
             * Note: not as described in rfc3986 section 5.2
             */
            function resolveRelativeReference(baseUrl, url) {
                var protocol = getProtocolScheme(url),
                    i;

                if (protocol) {
                    return url;
                }

                if (url.slice(0, 1) === '/') {
                    return getProtocolScheme(baseUrl) + '://' + getHostName(baseUrl) + url;
                }

                baseUrl = purify(baseUrl);

                i = baseUrl.indexOf('?');
                if (i >= 0) {
                    baseUrl = baseUrl.slice(0, i);
                }

                i = baseUrl.lastIndexOf('/');
                if (i !== baseUrl.length - 1) {
                    baseUrl = baseUrl.slice(0, i + 1);
                }

                return baseUrl + url;
            }

            function isSameHost(hostName, alias) {
                var offset;

                hostName = String(hostName).toLowerCase();
                alias = String(alias).toLowerCase();

                if (hostName === alias) {
                    return true;
                }

                if (alias.slice(0, 1) === '.') {
                    if (hostName === alias.slice(1)) {
                        return true;
                    }

                    offset = hostName.length - alias.length;

                    if ((offset > 0) && (hostName.slice(offset) === alias)) {
                        return true;
                    }
                }

                return false;
            }

            function getPathName(url) {
                var parser = document.createElement('a');
                if (url.indexOf('//') !== 0 && url.indexOf('http') !== 0) {
                    if (url.indexOf('*') === 0) {
                        url = url.substr(1);
                    }
                    if (url.indexOf('.') === 0) {
                        url = url.substr(1);
                    }
                    url = 'http://' + url;
                }

                parser.href = content.toAbsoluteUrl(url);

                if (parser.pathname) {
                    return parser.pathname;
                }

                return '';
            }

            function isSitePath(path, pathAlias) {
                if (!stringStartsWith(pathAlias, '/')) {
                    pathAlias = '/' + pathAlias;
                }

                if (!stringStartsWith(path, '/')) {
                    path = '/' + path;
                }

                var matchesAnyPath = (pathAlias === '/' || pathAlias === '/*');

                if (matchesAnyPath) {
                    return true;
                }

                if (path === pathAlias) {
                    return true;
                }

                pathAlias = String(pathAlias).toLowerCase();
                path = String(path).toLowerCase();

                // wildcard path support
                if (stringEndsWith(pathAlias, '*')) {
                    // remove the final '*' before comparing
                    pathAlias = pathAlias.slice(0, -1);

                    // Note: this is almost duplicated from just few lines above
                    matchesAnyPath = (!pathAlias || pathAlias === '/');

                    if (matchesAnyPath) {
                        return true;
                    }

                    if (path === pathAlias) {
                        return true;
                    }

                    // wildcard match
                    return path.indexOf(pathAlias) === 0;
                }

                // we need to append slashes so /foobarbaz won't match a site /foobar
                if (!stringEndsWith(path, '/')) {
                    path += '/';
                }

                if (!stringEndsWith(pathAlias, '/')) {
                    pathAlias += '/';
                }

                return path.indexOf(pathAlias) === 0;
            }

            /*
             * Is the host local? (i.e., not an outlink)
             */
            function isSiteHostName(hostName) {

                var i,
                    alias,
                    offset;

                for (i = 0; i < configHostsAlias.length; i++) {
                    alias = domainFixup(configHostsAlias[i].toLowerCase());

                    if (hostName === alias) {
                        return true;
                    }

                    if (alias.slice(0, 1) === '.') {
                        if (hostName === alias.slice(1)) {
                            return true;
                        }

                        offset = hostName.length - alias.length;

                        if ((offset > 0) && (hostName.slice(offset) === alias)) {
                            return true;
                        }
                    }
                }

                return false;
            }

            /*
             * Send image request to Cdlx server using GET.
             * The infamous web bug (or beacon) is a transparent, single pixel (1x1) image
             */
            function getImage(request, callback) {
                // make sure to actually load an image so callback gets invoked
                request = request.replace("send_image=0", "send_image=1");

                var image = new Image(1, 1);
                image.onload = function () {
                    iterator = 0; // To avoid JSLint warning of empty block
                    if (typeof callback === 'function') {
                        callback({ request: request, trackerUrl: configTrackerUrl, success: true });
                    }
                };
                image.onerror = function () {
                    if (typeof callback === 'function') {
                        callback({ request: request, trackerUrl: configTrackerUrl, success: false });
                    }
                };
                image.src = configTrackerUrl + (configTrackerUrl.indexOf('?') < 0 ? '?' : '&') + request;
            }

            /*
             * POST request to Cdlx server using XMLHttpRequest.
             */
            function sendXmlHttpRequest(request, callback, fallbackToGet) {
                if (!isDefined(fallbackToGet) || null === fallbackToGet) {
                    fallbackToGet = true;
                }

                if (isPageUnloading) {
                    return;
                }

                setTimeout(function () {
                    if (isPageUnloading) {
                        return;
                    }

                    try {
                        var xhr = windowAlias.XMLHttpRequest
                            ? new windowAlias.XMLHttpRequest()
                            : windowAlias.ActiveXObject
                                ? new ActiveXObject('Microsoft.XMLHTTP')
                                : null;

                        xhr.open('POST', configTrackerUrl, true);

                        // fallback on error
                        xhr.onreadystatechange = function () {
                            if (this.readyState === 4 && !(this.status >= 200 && this.status < 300)) {
                                if (fallbackToGet) {
                                    getImage(request, callback);
                                } else if (typeof callback === 'function') {
                                    callback({ request: request, trackerUrl: configTrackerUrl, success: false, xhr: this });
                                }

                            } else {
                                if (this.readyState === 4 && (typeof callback === 'function')) {
                                    callback({ request: request, trackerUrl: configTrackerUrl, success: true, xhr: this });
                                }
                            }
                        };

                        xhr.setRequestHeader('Content-Type', configRequestContentType);

                        xhr.withCredentials = true;

                        xhr.send(request);
                    } catch (e) {
                        if (fallbackToGet) {
                            getImage(request, callback);
                        } else if (typeof callback === 'function') {
                            callback({ request: request, trackerUrl: configTrackerUrl, success: false });
                        }
                    }
                }, 50);

            }

            function setExpireDateTime(delay) {

                var now = new Date();
                var time = now.getTime() + delay;

                if (!expireDateTime || time > expireDateTime) {
                    expireDateTime = time;
                }
            }
            function makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(callback) { //tosee
                var now = new Date();
                var timeNow = now.getTime();

                lastTrackerRequestTime = timeNow;

                if (timeNextTrackingRequestCanBeExecutedImmediately && timeNow < timeNextTrackingRequestCanBeExecutedImmediately) {
                    // we are in the time frame shortly after the first request. we have to delay this request a bit to make sure
                    // a visitor has been created meanwhile.

                    var timeToWait = timeNextTrackingRequestCanBeExecutedImmediately - timeNow;

                    setTimeout(callback, timeToWait);
                    setExpireDateTime(timeToWait + 50); // set timeout is not necessarily executed at timeToWait so delay a bit more
                    timeNextTrackingRequestCanBeExecutedImmediately += 50; // delay next tracking request by further 50ms to next execute them at same time

                    return;
                }

                if (timeNextTrackingRequestCanBeExecutedImmediately === false) {
                    // it is the first request, we want to execute this one directly and delay all the next one(s) within a delay.
                    // All requests after this delay can be executed as usual again
                    var delayInMs = 800;
                    timeNextTrackingRequestCanBeExecutedImmediately = timeNow + delayInMs;
                }

                callback();
            }

            /*
             * Send request
             */
            function sendRequest(request, delay, callback) {
                if (!configHasConsent) {
                    consentRequestsQueue.push(request);
                    return;
                }
                if (!configDoNotTrack && request) {
                    if (configConsentRequired && configHasConsent) { // send a consent=1 when explicit consent is given for the apache logs
                        request += '&consent=1';
                    }

                    makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(function () {

                        if (configRequestMethod === 'POST' || String(request).length > 2000) {
                            sendXmlHttpRequest(request, callback);
                        } else {
                            getImage(request, callback);
                        }

                        setExpireDateTime(delay);
                    });
                }
            }

            function canSendBulkRequest(requests) {
                if (configDoNotTrack) {
                    return false;
                }

                return (requests && requests.length);
            }

            function arrayChunk(theArray, chunkSize) {
                if (!chunkSize || chunkSize >= theArray.length) {
                    return [theArray];
                }

                var index = 0;
                var arrLength = theArray.length;
                var chunks = [];

                for (index; index < arrLength; index += chunkSize) {
                    chunks.push(theArray.slice(index, index + chunkSize));
                }

                return chunks;
            }

            /*
             * Send requests using bulk
             */
            function sendBulkRequest(requests, delay) {
                if (!canSendBulkRequest(requests)) {
                    return;
                }

                if (!configHasConsent) {
                    consentRequestsQueue.push(requests);
                    return;
                }

                makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(function () {
                    var chunks = arrayChunk(requests, 50);

                    var i = 0, bulk;
                    for (i; i < chunks.length; i++) {
                        bulk = '{"requests":["?' + chunks[i].join('","?') + '"]}';
                        sendXmlHttpRequest(bulk, null, false);
                    }

                    setExpireDateTime(delay);
                });
            }

            /*
             * Get cookie name with prefix and domain hash
             */
            function getCookieName(baseName) {
                return configCookieNamePrefix + baseName + '.' + configTrackerSiteId + '.' + domainHash;
            }

            /*
             * Does browser have cookies enabled (for this site)?
             */
            function hasCookies() {
                if (configCookiesDisabled) {
                    return '0';
                }

                var testCookieName = getCookieName('testcookie');
                setCookie(testCookieName, '1');

                return getCookie(testCookieName) === '1' ? '1' : '0';
            }

            /*
             * Update domain hash
             */
            function updateDomainHash() {
                domainHash = hash((configCookieDomain || domainAlias) + (configCookiePath || '/')).slice(0, 4); // 4 hexits = 16 bits
            }

            /*
             * Browser features (plugins, resolution, cookies)
             */
            function detectBrowserFeatures() {
                if (isDefined(browserFeatures.res)) {
                    return browserFeatures;
                }
                var i,
                    mimeType,
                    pluginMap = {
                        // document types
                        pdf: 'application/pdf',

                        // media players
                        qt: 'video/quicktime',
                        realp: 'audio/x-pn-realaudio-plugin',
                        wma: 'application/x-mplayer2',

                        // interactive multimedia
                        dir: 'application/x-director',
                        fla: 'application/x-shockwave-flash',

                        // RIA
                        java: 'application/x-java-vm',
                        gears: 'application/x-googlegears',
                        ag: 'application/x-silverlight'
                    };

                // detect browser features except IE < 11 (IE 11 user agent is no longer MSIE)
                if (!((new RegExp('MSIE')).test(navigatorAlias.userAgent))) {
                    // general plugin detection
                    if (navigatorAlias.mimeTypes && navigatorAlias.mimeTypes.length) {
                        for (i in pluginMap) {
                            if (Object.prototype.hasOwnProperty.call(pluginMap, i)) {
                                mimeType = navigatorAlias.mimeTypes[pluginMap[i]];
                                browserFeatures[i] = (mimeType && mimeType.enabledPlugin) ? '1' : '0';
                            }
                        }
                    }

                    // Safari and Opera
                    // IE6/IE7 navigator.javaEnabled can't be aliased, so test directly
                    // on Edge navigator.javaEnabled() always returns `true`, so ignore it
                    if (!((new RegExp('Edge[ /](\\d+[\\.\\d]+)')).test(navigatorAlias.userAgent)) &&
                        typeof navigator.javaEnabled !== 'unknown' &&
                        isDefined(navigatorAlias.javaEnabled) &&
                        navigatorAlias.javaEnabled()) {
                        browserFeatures.java = '1';
                    }

                    // Firefox
                    if (isFunction(windowAlias.GearsFactory)) {
                        browserFeatures.gears = '1';
                    }

                    // other browser features
                    browserFeatures.cookie = hasCookies();
                }

                var width = parseInt(screenAlias.width, 10);
                var height = parseInt(screenAlias.height, 10);
                browserFeatures.res = parseInt(width, 10) + 'x' + parseInt(height, 10);
                return browserFeatures;
            }

            /*
             * Inits the custom variables object
             */
            function getCustomVariablesFromCookie() {
                var cookieName = getCookieName('cvar'),
                    cookie = getCookie(cookieName);

                if (cookie.length) {
                    cookie = JSON.parse(cookie);

                    if (isObject(cookie)) {
                        return cookie;
                    }
                }

                return {};
            }

            /*
             * Lazy loads the custom variables from the cookie, only once during this page view
             */
            function loadCustomVariables() {
                if (customVariables === false) {
                    customVariables = getCustomVariablesFromCookie();
                }
            }

            /*
             * Generate a pseudo-unique ID to fingerprint this user
             * 16 hexits = 64 bits
             * note: this isn't a RFC4122-compliant UUID
             */
            function generateRandomUuid() {
                var browserFeatures = detectBrowserFeatures();
                return hash(
                    (navigatorAlias.userAgent || '') +
                    (navigatorAlias.platform || '') +
                    JSON.stringify(browserFeatures) +
                    (new Date()).getTime() +
                    Math.random()
                ).slice(0, 16);
            }

            function generateBrowserSpecificId() {
                var browserFeatures = detectBrowserFeatures();

                return hash(
                    (navigatorAlias.userAgent || '') +
                    (navigatorAlias.platform || '') +
                    JSON.stringify(browserFeatures)).slice(0, 6);
            }

            function getCurrentTimestampInSeconds() {
                return Math.floor((new Date()).getTime() / 1000);
            }

            function makeCrossDomainDeviceId() {
                var timestamp = getCurrentTimestampInSeconds();
                var browserId = generateBrowserSpecificId();
                var deviceId = String(timestamp) + browserId;

                return deviceId;
            }

            function isSameCrossDomainDevice(deviceIdFromUrl) {
                deviceIdFromUrl = String(deviceIdFromUrl);

                var thisBrowserId = generateBrowserSpecificId();
                var lengthBrowserId = thisBrowserId.length;

                var browserIdInUrl = deviceIdFromUrl.substr(-1 * lengthBrowserId, lengthBrowserId);
                var timestampInUrl = parseInt(deviceIdFromUrl.substr(0, deviceIdFromUrl.length - lengthBrowserId), 10);

                if (timestampInUrl && browserIdInUrl && browserIdInUrl === thisBrowserId) {
                    // we only reuse visitorId when used on same device / browser

                    var currentTimestampInSeconds = getCurrentTimestampInSeconds();

                    if (configVisitorIdUrlParameterTimeoutInSeconds <= 0) {
                        return true;
                    }
                    if (currentTimestampInSeconds >= timestampInUrl
                        && currentTimestampInSeconds <= (timestampInUrl + configVisitorIdUrlParameterTimeoutInSeconds)) {
                        // we only use visitorId if it was generated max 180 seconds ago
                        return true;
                    }
                }

                return false;
            }

            function getVisitorIdFromUrl(url) {
                if (!crossDomainTrackingEnabled) {
                    return '';
                }

                // problem different timezone or when the time on the computer is not set correctly it may re-use
                // the same visitorId again. therefore we also have a factor like hashed user agent to reduce possible
                // activation of a visitorId on other device
                var visitorIdParam = getUrlParameter(url, configVisitorIdUrlParameter);

                if (!visitorIdParam) {
                    return '';
                }

                visitorIdParam = String(visitorIdParam);

                var pattern = new RegExp("^[a-zA-Z0-9]+$");

                if (visitorIdParam.length === 32 && pattern.test(visitorIdParam)) {
                    var visitorDevice = visitorIdParam.substr(16, 32);

                    if (isSameCrossDomainDevice(visitorDevice)) {
                        var visitorId = visitorIdParam.substr(0, 16);
                        return visitorId;
                    }
                }

                return '';
            }

            /*
             * Load visitor ID cookie
             */
            function loadVisitorIdCookie() {

                if (!visitorUUID) {
                    // we are using locationHrefAlias and not currentUrl on purpose to for sure get the passed URL parameters
                    // from original URL
                    visitorUUID = getVisitorIdFromUrl(locationHrefAlias);
                }

                var now = new Date(),
                    nowTs = Math.round(now.getTime() / 1000),
                    visitorIdCookieName = getCookieName('id'),
                    id = getCookie(visitorIdCookieName),
                    cookieValue,
                    uuid;

                // Visitor ID cookie found
                if (id) {
                    cookieValue = id.split('.');

                    // returning visitor flag
                    cookieValue.unshift('0');

                    if (visitorUUID.length) {
                        cookieValue[1] = visitorUUID;
                    }
                    return cookieValue;
                }

                if (visitorUUID.length) {
                    uuid = visitorUUID;
                } else if ('0' === hasCookies()) {
                    uuid = '';
                } else {
                    uuid = generateRandomUuid();
                }

                // No visitor ID cookie, let's create a new one
                cookieValue = [
                    // new visitor
                    '1',

                    // uuid
                    uuid,

                    // creation timestamp - seconds since Unix epoch
                    nowTs,

                    // visitCount - 0 = no previous visit
                    0,

                    // current visit timestamp
                    nowTs,

                    // last visit timestamp - blank = no previous visit
                    '',

                    // last ecommerce order timestamp
                    ''
                ];

                return cookieValue;
            }


            /**
             * Loads the Visitor ID cookie and returns a named array of values
             */
            function getValuesFromVisitorIdCookie() {
                var cookieVisitorIdValue = loadVisitorIdCookie(),
                    newVisitor = cookieVisitorIdValue[0],
                    uuid = cookieVisitorIdValue[1],
                    createTs = cookieVisitorIdValue[2],
                    visitCount = cookieVisitorIdValue[3],
                    currentVisitTs = cookieVisitorIdValue[4],
                    lastVisitTs = cookieVisitorIdValue[5];

                // case migrating from pre-1.5 cookies
                if (!isDefined(cookieVisitorIdValue[6])) {
                    cookieVisitorIdValue[6] = "";
                }

                var lastEcommerceOrderTs = cookieVisitorIdValue[6];

                return {
                    newVisitor: newVisitor,
                    uuid: uuid,
                    createTs: createTs,
                    visitCount: visitCount,
                    currentVisitTs: currentVisitTs,
                    lastVisitTs: lastVisitTs,
                    lastEcommerceOrderTs: lastEcommerceOrderTs
                };
            }

            function getRemainingVisitorCookieTimeout() {
                var now = new Date(),
                    nowTs = now.getTime(),
                    cookieCreatedTs = getValuesFromVisitorIdCookie().createTs;

                var createTs = parseInt(cookieCreatedTs, 10);
                var originalTimeout = (createTs * 1000) + configVisitorCookieTimeout - nowTs;
                return originalTimeout;
            }

            /*
             * Sets the Visitor ID cookie
             */
            function setVisitorIdCookie(visitorIdCookieValues) {

                if (!configTrackerSiteId) {
                    // when called before Site ID was set
                    return;
                }

                var now = new Date(),
                    nowTs = Math.round(now.getTime() / 1000);

                if (!isDefined(visitorIdCookieValues)) {
                    visitorIdCookieValues = getValuesFromVisitorIdCookie();
                }

                var cookieValue = visitorIdCookieValues.uuid + '.' +
                    visitorIdCookieValues.createTs + '.' +
                    visitorIdCookieValues.visitCount + '.' +
                    nowTs + '.' +
                    visitorIdCookieValues.lastVisitTs + '.' +
                    visitorIdCookieValues.lastEcommerceOrderTs;

                setCookie(getCookieName('id'), cookieValue, getRemainingVisitorCookieTimeout(), configCookiePath, configCookieDomain, configCookieIsSecure);
            }

            /*
             * Loads the referrer attribution information
             *
             * @returns array
             *  0: campaign name
             *  1: campaign keyword
             *  2: timestamp
             *  3: raw URL
             */
            function loadReferrerAttributionCookie() {
                var cookie = getCookie('_cardlytics_id');

                if (cookie.length) {
                    try {
                        cookie = JSON.parse(cookie);
                        if (isObject(cookie)) {
                            return cookie;
                        }
                    } catch (ignore) {
                        // Pre 1.3, this cookie was not JSON encoded
                    }
                }

                return [
                    '',
                    '',
                    0,
                    ''
                ];
            }

            function deleteCookie(cookieName, path, domain) {
                setCookie(cookieName, '', -86400, path, domain);
            }

            function isPossibleToSetCookieOnDomain(domainToTest) {
                var valueToSet = 'testvalue';
                setCookie('test', valueToSet, 10000, null, domainToTest);

                if (getCookie('test') === valueToSet) {
                    deleteCookie('test', null, domainToTest);

                    return true;
                }

                return false;
            }

            function deleteCookies() {
                var savedConfigCookiesDisabled = configCookiesDisabled;

                // Temporarily allow cookies just to delete the existing ones
                configCookiesDisabled = false;

                var index, cookieName;

                for (index = 0; index < configCookiesToDelete.length; index++) {
                    cookieName = getCookieName(configCookiesToDelete[index]);
                    if (cookieName !== CONSENT_REMOVED_COOKIE_NAME && cookieName !== CONSENT_COOKIE_NAME && 0 !== getCookie(cookieName)) {
                        deleteCookie(cookieName, configCookiePath, configCookieDomain);
                    }
                }

                configCookiesDisabled = savedConfigCookiesDisabled;
            }

            function setSiteId(siteId) {
                configTrackerSiteId = siteId;
                setVisitorIdCookie();
            }

            function sortObjectByKeys(value) {
                if (!value || !isObject(value)) {
                    return;
                }

                // Object.keys(value) is not supported by all browsers, we get the keys manually
                var keys = [];
                var key;

                for (key in value) {
                    if (Object.prototype.hasOwnProperty.call(value, key)) {
                        keys.push(key);
                    }
                }

                var normalized = {};
                keys.sort();
                var len = keys.length;
                var i;

                for (i = 0; i < len; i++) {
                    normalized[keys[i]] = value[keys[i]];
                }

                return normalized;
            }

            /**
             * Creates the session cookie
             */
            function setSessionCookie() {
                setCookie(getCookieName('ses'), '1', configSessionCookieTimeout, configCookiePath, configCookieDomain, configCookieIsSecure);
            }

            function generateUniqueId() {
                var id = '';
                var chars = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
                var charLen = chars.length;
                var i;

                for (i = 0; i < 6; i++) {
                    id += chars.charAt(Math.floor(Math.random() * charLen));
                }

                return id;
            }

            // need to be modified
            function getRequest(request, customData, pluginMethod, currentEcommerceOrderTs) {
                var i,
                    now = new Date(),
                    nowTs = Math.round(now.getTime() / 1000),
                    referralTs,
                    referralUrl,
                    referralUrlMaxLength = 1024,
                    currentReferrerHostName,
                    originalReferrerHostName,
                    customVariablesCopy = customVariables,
                    cookieSessionName = getCookieName('ses'),
                    cookieReferrerName = getCookieName('ref'),
                    cookieCustomVariablesName = getCookieName('cvar'),
                    cookieSessionValue = getCookie(cookieSessionName),
                    attributionCookie = loadReferrerAttributionCookie(),
                    currentUrl = configCustomUrl || locationHrefAlias,
                    campaignNameDetected,
                    campaignKeywordDetected;

                if (configCookiesDisabled) {
                    deleteCookies();
                }

                if (configDoNotTrack) {
                    return '';
                }

                var cookieVisitorIdValues = getValuesFromVisitorIdCookie();
                if (!isDefined(currentEcommerceOrderTs)) {
                    currentEcommerceOrderTs = "";
                }

                // send charset if document charset is not utf-8. sometimes encoding
                // of urls will be the same as this and not utf-8, which will cause problems
                // do not send charset if it is utf8 since it's assumed by default in Cdlx
                var charSet = documentAlias.characterSet || documentAlias.charset;

                if (!charSet || charSet.toLowerCase() === 'utf-8') {
                    charSet = null;
                }

                campaignNameDetected = attributionCookie[0];
                campaignKeywordDetected = attributionCookie[1];
                referralTs = attributionCookie[2];
                referralUrl = attributionCookie[3];

                if (!cookieSessionValue) {
                    // cookie 'ses' was not found: we consider this the start of a 'session'

                    // here we make sure that if 'ses' cookie is deleted few times within the visit
                    // and so this code path is triggered many times for one visit,
                    // we only increase visitCount once per Visit window (default 30min)
                    var visitDuration = configSessionCookieTimeout / 1000;
                    if (!cookieVisitorIdValues.lastVisitTs
                        || (nowTs - cookieVisitorIdValues.lastVisitTs) > visitDuration) {
                        cookieVisitorIdValues.visitCount++;
                        cookieVisitorIdValues.lastVisitTs = cookieVisitorIdValues.currentVisitTs;
                    }


                    // Detect the campaign information from the current URL
                    // Only if campaign wasn't previously set
                    // Or if it was set but we must attribute to the most recent one
                    // Note: we are working on the currentUrl before purify() since we can parse the campaign parameters in the hash tag
                    if (!configConversionAttributionFirstReferrer
                        || !campaignNameDetected.length) {
                        for (i in configCampaignNameParameters) {
                            if (Object.prototype.hasOwnProperty.call(configCampaignNameParameters, i)) {
                                campaignNameDetected = getUrlParameter(currentUrl, configCampaignNameParameters[i]);

                                if (campaignNameDetected.length) {
                                    break;
                                }
                            }
                        }

                        for (i in configCampaignKeywordParameters) {
                            if (Object.prototype.hasOwnProperty.call(configCampaignKeywordParameters, i)) {
                                campaignKeywordDetected = getUrlParameter(currentUrl, configCampaignKeywordParameters[i]);

                                if (campaignKeywordDetected.length) {
                                    break;
                                }
                            }
                        }
                    }

                    // Store the referrer URL and time in the cookie;
                    // referral URL depends on the first or last referrer attribution
                    currentReferrerHostName = getHostName(configReferrerUrl);
                    originalReferrerHostName = referralUrl.length ? getHostName(referralUrl) : '';

                    if (currentReferrerHostName.length && // there is a referrer
                        !isSiteHostName(currentReferrerHostName) && // domain is not the current domain
                        (!configConversionAttributionFirstReferrer || // attribute to last known referrer
                            !originalReferrerHostName.length || // previously empty
                            isSiteHostName(originalReferrerHostName))) { // previously set but in current domain
                        referralUrl = configReferrerUrl;
                    }

                    // Set the referral cookie if we have either a Referrer URL, or detected a Campaign (or both)
                    if (referralUrl.length
                        || campaignNameDetected.length) {
                        referralTs = nowTs;
                        attributionCookie = [
                            campaignNameDetected,
                            campaignKeywordDetected,
                            referralTs,
                            purify(referralUrl.slice(0, referralUrlMaxLength))
                        ];

                        setCookie(cookieReferrerName, JSON.stringify(attributionCookie), configReferralCookieTimeout, configCookiePath, configCookieDomain);
                    }
                }

                // build out the rest of the request
                request += '&idsite=' + configTrackerSiteId +
                    '&rec=1' +
                    '&r=' + String(Math.random()).slice(2, 8) + // keep the string to a minimum
                    '&h=' + now.getHours() + '&m=' + now.getMinutes() + '&s=' + now.getSeconds() +
                    '&url=' + encodeWrapper(purify(currentUrl)) +
                    (configReferrerUrl.length ? '&urlref=' + encodeWrapper(purify(configReferrerUrl)) : '') +
                    ((configUserId && configUserId.length) ? '&uid=' + encodeWrapper(configUserId) : '') +
                    '&_id=' + cookieVisitorIdValues.uuid + '&_idts=' + cookieVisitorIdValues.createTs + '&_idvc=' + cookieVisitorIdValues.visitCount +
                    '&_idn=' + cookieVisitorIdValues.newVisitor + // currently unused
                    (campaignNameDetected.length ? '&_rcn=' + encodeWrapper(campaignNameDetected) : '') +
                    (campaignKeywordDetected.length ? '&_rck=' + encodeWrapper(campaignKeywordDetected) : '') +
                    '&_refts=' + referralTs +
                    '&_viewts=' + cookieVisitorIdValues.lastVisitTs +
                    (String(cookieVisitorIdValues.lastEcommerceOrderTs).length ? '&_ects=' + cookieVisitorIdValues.lastEcommerceOrderTs : '') +
                    (String(referralUrl).length ? '&_ref=' + encodeWrapper(purify(referralUrl.slice(0, referralUrlMaxLength))) : '') +
                    (charSet ? '&cs=' + encodeWrapper(charSet) : '') +
                    '&send_image=0';

                var browserFeatures = detectBrowserFeatures();
                // browser features
                for (i in browserFeatures) {
                    if (Object.prototype.hasOwnProperty.call(browserFeatures, i)) {
                        request += '&' + i + '=' + browserFeatures[i];
                    }
                }

                var customDimensionIdsAlreadyHandled = [];
                if (customData) {
                    for (i in customData) {
                        if (Object.prototype.hasOwnProperty.call(customData, i) && /^dimension\d+$/.test(i)) {
                            var index = i.replace('dimension', '');
                            customDimensionIdsAlreadyHandled.push(parseInt(index, 10));
                            customDimensionIdsAlreadyHandled.push(String(index));
                            request += '&' + i + '=' + encodeWrapper(customData[i]);
                            delete customData[i];
                        }
                    }
                }

                if (customData && isObjectEmpty(customData)) {
                    customData = null;
                    // we deleted all keys from custom data
                }

                // custom dimensions
                for (i in customDimensions) {
                    if (Object.prototype.hasOwnProperty.call(customDimensions, i)) {
                        var isNotSetYet = (-1 === customDimensionIdsAlreadyHandled.indexOf(i));
                        if (isNotSetYet) {
                            request += '&dimension' + i + '=' + encodeWrapper(customDimensions[i]);
                        }
                    }
                }

                // custom data
                if (customData) {
                    request += '&data=' + encodeWrapper(JSON.stringify(customData));
                } else if (configCustomData) {
                    request += '&data=' + encodeWrapper(JSON.stringify(configCustomData));
                }

                // Custom Variables, scope "page"
                function appendCustomVariablesToRequest(customVariables, parameterName) {
                    var customVariablesStringified = JSON.stringify(customVariables);
                    if (customVariablesStringified.length > 2) {
                        return '&' + parameterName + '=' + encodeWrapper(customVariablesStringified);
                    }
                    return '';
                }

                var sortedCustomVarPage = sortObjectByKeys(customVariablesPage);
                var sortedCustomVarEvent = sortObjectByKeys(customVariablesEvent);

                request += appendCustomVariablesToRequest(sortedCustomVarPage, 'cvar');
                request += appendCustomVariablesToRequest(sortedCustomVarEvent, 'e_cvar');

                // Custom Variables, scope "visit"
                if (customVariables) {
                    request += appendCustomVariablesToRequest(customVariables, '_cvar');

                    // Don't save deleted custom variables in the cookie
                    for (i in customVariablesCopy) {
                        if (Object.prototype.hasOwnProperty.call(customVariablesCopy, i)) {
                            if (customVariables[i][0] === '' || customVariables[i][1] === '') {
                                delete customVariables[i];
                            }
                        }
                    }

                    if (configStoreCustomVariablesInCookie) {
                        setCookie(cookieCustomVariablesName, JSON.stringify(customVariables), configSessionCookieTimeout, configCookiePath, configCookieDomain);
                    }
                }

                // performance tracking
                if (configPerformanceTrackingEnabled) {
                    if (configPerformanceGenerationTime) {
                        request += '&gt_ms=' + configPerformanceGenerationTime;
                    } else if (performanceAlias && performanceAlias.timing
                        && performanceAlias.timing.requestStart && performanceAlias.timing.responseEnd) {
                        request += '&gt_ms=' + (performanceAlias.timing.responseEnd - performanceAlias.timing.requestStart);
                    }
                }

                if (configIdPageView) {
                    request += '&pv_id=' + configIdPageView;
                }

                // update cookies
                cookieVisitorIdValues.lastEcommerceOrderTs = isDefined(currentEcommerceOrderTs) && String(currentEcommerceOrderTs).length ? currentEcommerceOrderTs : cookieVisitorIdValues.lastEcommerceOrderTs;
                setVisitorIdCookie(cookieVisitorIdValues);
                setSessionCookie();

                // tracker plugin hook
                // request += executePluginMethod(pluginMethod, {tracker: trackerInstance, request: request});

                if (configAppendToTrackingUrl.length) {
                    request += '&' + configAppendToTrackingUrl;
                }

                if (isFunction(configCustomRequestContentProcessing)) {
                    request = configCustomRequestContentProcessing(request);
                }

                return request;
            }


            /*
             * Log the page view / visit
             */
            function logPageView(customTitle, customData, callback) { //important rc
                configIdPageView = generateUniqueId();

                var request = getRequestcdlx('action_name=' + encodeWrapper(titleFixup(customTitle || configTitle)), customData, 'log');

                sendRequest(request, configTrackerPause, callback);
            }
            function getRequestcdlx(request, customdata) {
                var currentUrl = configCustomUrl || locationHrefAlias,
                    referralUrl,
                    referralUrlMaxLength = 1024,
                    attributionCookie = loadReferrerAttributionCookie(),
                    now = new Date();
                var charSet = documentAlias.characterSet || documentAlias.charset;
                referralUrl = attributionCookie;
                request += '&idsite=' + configTrackerSiteId +
                    '&h=' + now.getHours() + '&m=' + now.getMinutes() + '&s=' + now.getSeconds() +
                    '&url=' + encodeWrapper(purify(currentUrl)) +
                    (configReferrerUrl.length ? '&urlref=' + encodeWrapper(purify(configReferrerUrl)) : '') +
                    ((configUserId && configUserId.length) ? '&uid=' + encodeWrapper(configUserId) : '') +
                    (String(referralUrl).length ? '&_ref=' + encodeWrapper(purify(referralUrl.slice(0, referralUrlMaxLength))) : '') +
                    (charSet ? '&cs=' + encodeWrapper(charSet) : '') +
                    '&send_image=1';
                return request;
            }

            /*
             * Construct regular expression of classes
             */
            function getClassesRegExp(configClasses, defaultClass) {
                var i,
                    classesRegExp = '(^| )(Cdlx[_-]' + defaultClass;

                if (configClasses) {
                    for (i = 0; i < configClasses.length; i++) {
                        classesRegExp += '|' + configClasses[i];
                    }
                }

                classesRegExp += ')( |$)';

                return new RegExp(classesRegExp);
            }

            function startsUrlWithTrackerUrl(url) {
                return (configTrackerUrl && url && 0 === String(url).indexOf(configTrackerUrl));
            }
            function buildEventRequest(category, action, name, value) //important rc
            {
                return 'e_c=' + encodeWrapper(category)
                    + '&e_a=' + encodeWrapper(action)
                    + (isDefined(name) ? '&e_n=' + encodeWrapper(name) : '')
                    + (isDefined(value) ? '&e_v=' + encodeWrapper(value) : '');
            }

            /*
             * Log the event
             */
            function logEvent(category, action, name, value, customData, callback) {
                // Category and Action are required parameters
                if (trim(String(category)).length === 0 || trim(String(action)).length === 0) {
                    logConsoleError('Error while logging event: Parameters `category` and `action` must not be empty or filled with whitespaces');
                    return false;
                }
                var request = getRequestcdlx(
                    buildEventRequest(category, action, name, value),
                    customData,
                    'event'
                );

                sendRequest(request, configTrackerPause, callback);
            }
            function prefixPropertyName(prefix, propertyName) {
                if (prefix !== '') {
                    return prefix + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
                }

                return propertyName;
            }

            /*
             * Check for pre-rendered web pages, and log the page view/link/goal
             * according to the configuration and/or visibility
             *
             * @see http://dvcs.w3.org/hg/webperf/raw-file/tip/specs/PageVisibility/Overview.html
             */
            function trackCallback(callback) {
                var isPreRendered,
                    i,
                    // Chrome 13, IE10, FF10
                    prefixes = ['', 'webkit', 'ms', 'moz'],
                    prefix;

                if (!configCountPreRendered) {
                    for (i = 0; i < prefixes.length; i++) {
                        prefix = prefixes[i];

                        // does this browser support the page visibility API?
                        if (Object.prototype.hasOwnProperty.call(documentAlias, prefixPropertyName(prefix, 'hidden'))) {
                            // if pre-rendered, then defer callback until page visibility changes
                            if (documentAlias[prefixPropertyName(prefix, 'visibilityState')] === 'prerender') {
                                isPreRendered = true;
                            }
                            break;
                        }
                    }
                }

                if (isPreRendered) {
                    // note: the event name doesn't follow the same naming convention as vendor properties
                    addEventListener(documentAlias, prefix + 'visibilitychange', function ready() {
                        documentAlias.removeEventListener(prefix + 'visibilitychange', ready, false);
                        callback();
                    });

                    return;
                }

                // configCountPreRendered === true || isPreRendered === false
                callback();
            }

            function getCrossDomainVisitorId() {
                var visitorId = getValuesFromVisitorIdCookie().uuid;
                var deviceId = makeCrossDomainDeviceId();
                return visitorId + deviceId;
            }
            /*</DEBUG>*/

            var requestQueue = {
                enabled: true,
                requests: [],
                timeout: null,
                interval: 2500,
                sendRequests: function () {
                    var requestsToTrack = this.requests;
                    this.requests = [];
                    if (requestsToTrack.length === 1) {
                        sendRequest(requestsToTrack[0], configTrackerPause);
                    } else {
                        sendBulkRequest(requestsToTrack, configTrackerPause);
                    }
                },
                push: function (requestUrl) {
                    if (!requestUrl) {
                        return;
                    }
                    if (isPageUnloading || !this.enabled) {
                        // we don't queue as we need to ensure the request will be sent when the page is unloading...
                        sendRequest(requestUrl, configTrackerPause);
                        return;
                    }

                    requestQueue.requests.push(requestUrl);

                    if (this.timeout) {
                        clearTimeout(this.timeout);
                        this.timeout = null;
                    }
                    // we always extend by another 2.5 seconds after receiving a tracking request
                    this.timeout = setTimeout(function () {
                        requestQueue.timeout = null;
                        requestQueue.sendRequests();
                    }, requestQueue.interval);

                    var trackerQueueId = 'RequestQueue' + uniqueTrackerId;
                    if (!Object.prototype.hasOwnProperty.call(plugins, trackerQueueId)) {
                        // we setup one unload handler per tracker...
                        // Cdlx.addPlugin might not be defined at this point, we add the plugin directly also to make
                        // JSLint happy.
                        plugins[trackerQueueId] = {
                            unload: function () {
                                if (requestQueue.timeout) {
                                    clearTimeout(requestQueue.timeout);
                                }
                                requestQueue.sendRequests();
                            }
                        };
                    }
                }
            };
            /************************************************************
             * Constructor
             ************************************************************/

            /*
             * initialize tracker
             */
            updateDomainHash();
            setVisitorIdCookie();

            // this.getQuery = function () {
            //     return query;
            // };
            this.getContent = function () {
                return content;
            };
            this.setVisitorId = function (visitorId) {
                visitorUUID = visitorId;
            };


            this.trackCallbackOnLoad = trackCallbackOnLoad;
            this.trackCallbackOnReady = trackCallbackOnReady;
            this.getDomains = function () {
                return configHostsAlias;
            };
            this.getConfigIdPageView = function () {
                return configIdPageView;
            };
            this.getConfigVisitorCookieTimeout = function () {
                return configVisitorCookieTimeout;
            };
            this.removeAllAsyncTrackersButFirst = function () {
                var firstTracker = asyncTrackers[0];
                asyncTrackers = [firstTracker];
            };
            this.getConsentRequestsQueue = function () {
                return consentRequestsQueue;
            };
            this.getRequestQueue = function () {
                return requestQueue;
            };
            this.unsetPageIsUnloading = function () {
                isPageUnloading = false;
            };
            this.hasConsent = function () {
                return configHasConsent;
            };
            this.getRemainingVisitorCookieTimeout = getRemainingVisitorCookieTimeout;
            /*</DEBUG>*/

            /**
             * Get visitor ID (from first party cookie)
             *
             * @return string Visitor ID in hexits (or empty string, if not yet known)
             */
            this.getVisitorId = function () {
                return getValuesFromVisitorIdCookie().uuid;
            };

            /**
             * Get the visitor information (from first party cookie)
             *
             * @return array
             */
            this.getVisitorInfo = function () {
                // Note: in a new method, we could return also return getValuesFromVisitorIdCookie()
                //       which returns named parameters rather than returning integer indexed array
                return loadVisitorIdCookie();
            };
            this.getAttributionInfo = function () {
                return loadReferrerAttributionCookie();
            };



            /**
             * Get the time at which the referrer (used for Goal Attribution) was detected
             *
             * @return int Timestamp or 0 if no referrer currently set
             */
            this.getAttributionReferrerTimestamp = function () {
                return loadReferrerAttributionCookie()[2];
            };

            /**
             * Get the full referrer URL that will be used for Goal Attribution
             *
             * @return string Raw URL, or empty string '' if no referrer currently set
             */
            this.getAttributionReferrerUrl = function () {
                return loadReferrerAttributionCookie()[3];
            };

            /**
             * Specify the Cdlx tracking URL
             *
             * @param string trackerUrl
             */
            this.setTrackerUrl = function (trackerUrl) {
                configTrackerUrl = trackerUrl;
            };

            /**
             * Returns the Cdlx tracking URL
             * @returns string
             */
            this.getTrackerUrl = function () {
                return configTrackerUrl;
            };


            /**
             * Adds a new tracker. All sent requests will be also sent to the given siteId and cdlxUrl.
             *
             * @param string cdlxUrl  The tracker URL of the current tracker instance
             * @param int|string siteId
             * @return Tracker
             */
            this.addTracker = function (cdlxUrl, siteId) { //important rc
                if (!isDefined(cdlxUrl) || null === cdlxUrl) {
                    cdlxUrl = this.getTrackerUrl();
                }

                var tracker = new Tracker(cdlxUrl, siteId);

                asyncTrackers.push(tracker);

                Cdlx.trigger('TrackerAdded', [this]);

                return tracker;
            };

            /**
             * Returns the site ID
             *
             * @returns int
             */
            this.getSiteId = function () {
                return configTrackerSiteId;
            };

            /**
             * Specify the site ID
             *
             * @param int|string siteId
             */
            this.setSiteId = function (siteId) {
                setSiteId(siteId);
            };

            /**
             * Clears the User ID and generates a new visitor id.
             */
            this.resetUserId = function () {
                configUserId = '';
            };

            /**
             * Sets a User ID to this user (such as an email address or a username)
             *
             * @param string User ID
             */
            this.setUserId = function (userId) {
                if (isNumberOrHasLength(userId)) {
                    configUserId = userId;
                }
            };

            /**
             * Gets the User ID if set.
             *
             * @returns string User ID
             */
            this.getUserId = function () {
                return configUserId;
            };

            /**
             * Pass custom data to the server
             *
             * Examples:
             *   tracker.setCustomData(object);
             *   tracker.setCustomData(key, value);
             *
             * @param mixed key_or_obj
             * @param mixed opt_value
             */
            this.setCustomData = function (key_or_obj, opt_value) {
                if (isObject(key_or_obj)) {
                    configCustomData = key_or_obj;
                } else {
                    if (!configCustomData) {
                        configCustomData = {};
                    }
                    configCustomData[key_or_obj] = opt_value;
                }
            };

            /**
             * Get custom data
             *
             * @return mixed
             */
            this.getCustomData = function () {
                return configCustomData;
            };

            this.setCustomRequestProcessing = function (customRequestContentProcessingLogic) {
                configCustomRequestContentProcessing = customRequestContentProcessingLogic;
            };


            this.appendToTrackingUrl = function (queryString) {
                configAppendToTrackingUrl = queryString;
            };


            this.getRequest = function (request) {
                return getRequest(request);
            };

            this.setCustomDimension = function (customDimensionId, value) {
                customDimensionId = parseInt(customDimensionId, 10);
                if (customDimensionId > 0) {
                    if (!isDefined(value)) {
                        value = '';
                    }
                    if (!isString(value)) {
                        value = String(value);
                    }
                    customDimensions[customDimensionId] = value;
                }
            };

            /**
             * Get a stored value for a specific Custom Dimension index.
             *
             * @param int index A Custom Dimension index
             */
            this.getCustomDimension = function (customDimensionId) {
                customDimensionId = parseInt(customDimensionId, 10);
                if (customDimensionId > 0 && Object.prototype.hasOwnProperty.call(customDimensions, customDimensionId)) {
                    return customDimensions[customDimensionId];
                }
            };

            /**
             * Delete a custom dimension.
             *
             * @param int index Custom dimension Id
             */
            this.deleteCustomDimension = function (customDimensionId) {
                customDimensionId = parseInt(customDimensionId, 10);
                if (customDimensionId > 0) {
                    delete customDimensions[customDimensionId];
                }
            };

            /**
             * Set custom variable within this visit
             *
             * @param int index Custom variable slot ID from 1-5
             * @param string name
             * @param string value
             * @param string scope Scope of Custom Variable:
             *                     - "visit" will store the name/value in the visit and will persist it in the cookie for the duration of the visit,
             *                     - "page" will store the name/value in the next page view tracked.
             *                     - "event" will store the name/value in the next event tracked.
             */
            this.setCustomVariable = function (index, name, value, scope) {
                var toRecord;

                if (!isDefined(scope)) {
                    scope = 'visit';
                }
                if (!isDefined(name)) {
                    return;
                }
                if (!isDefined(value)) {
                    value = "";
                }
                if (index > 0) {
                    name = !isString(name) ? String(name) : name;
                    value = !isString(value) ? String(value) : value;
                    toRecord = [name.slice(0, customVariableMaximumLength), value.slice(0, customVariableMaximumLength)];
                    // numeric scope is there for GA compatibility
                    if (scope === 'visit' || scope === 2) {
                        loadCustomVariables();
                        customVariables[index] = toRecord;
                    } else if (scope === 'page' || scope === 3) {
                        customVariablesPage[index] = toRecord;
                    } else if (scope === 'event') { /* GA does not have 'event' scope but we do */
                        customVariablesEvent[index] = toRecord;
                    }
                }
            };

            /**
             * Get custom variable
             *
             * @param int index Custom variable slot ID from 1-5
             * @param string scope Scope of Custom Variable: "visit" or "page" or "event"
             */
            this.getCustomVariable = function (index, scope) {
                var cvar;

                if (!isDefined(scope)) {
                    scope = "visit";
                }

                if (scope === "page" || scope === 3) {
                    cvar = customVariablesPage[index];
                } else if (scope === "event") {
                    cvar = customVariablesEvent[index];
                } else if (scope === "visit" || scope === 2) {
                    loadCustomVariables();
                    cvar = customVariables[index];
                }

                if (!isDefined(cvar)
                    || (cvar && cvar[0] === '')) {
                    return false;
                }

                return cvar;
            };

            /**
             * Delete custom variable
             *
             * @param int index Custom variable slot ID from 1-5
             * @param string scope
             */
            this.deleteCustomVariable = function (index, scope) {
                // Only delete if it was there already
                if (this.getCustomVariable(index, scope)) {
                    this.setCustomVariable(index, '', '', scope);
                }
            };

            /**
             * Deletes all custom variables for a certain scope.
             *
             * @param string scope
             */
            this.deleteCustomVariables = function (scope) {
                if (scope === "page" || scope === 3) {
                    customVariablesPage = {};
                } else if (scope === "event") {
                    customVariablesEvent = {};
                } else if (scope === "visit" || scope === 2) {
                    customVariables = {};
                }
            };

            /**
             * When called then the Custom Variables of scope "visit" will be stored (persisted) in a first party cookie
             * for the duration of the visit. This is useful if you want to call getCustomVariable later in the visit.
             *
             * By default, Custom Variables of scope "visit" are not stored on the visitor's computer.
             */
            this.storeCustomVariablesInCookie = function () {
                configStoreCustomVariablesInCookie = true;
            };

            /**
             * Set delay for link tracking (in milliseconds)
             *
             * @param int delay
             */
            this.setLinkTrackingTimer = function (delay) { //tosee
                configTrackerPause = delay;
            };

            /**
             * Get delay for link tracking (in milliseconds)
             *
             * @param int delay
             */
            this.getLinkTrackingTimer = function () { //tosee
                return configTrackerPause;
            };

            this.setDomains = function (hostsAlias) {
                configHostsAlias = isString(hostsAlias) ? [hostsAlias] : hostsAlias;

                var hasDomainAliasAlready = false, i = 0, alias;
                for (i; i < configHostsAlias.length; i++) {
                    alias = String(configHostsAlias[i]);

                    if (isSameHost(domainAlias, domainFixup(alias))) {
                        hasDomainAliasAlready = true;
                        break;
                    }

                    var pathName = getPathName(alias);
                    if (pathName && pathName !== '/' && pathName !== '/*') {
                        hasDomainAliasAlready = true;
                        break;
                    }
                }

                // The current domain will be added automatically if no given host alias contains a path
                // and if no host alias is already given for the current host alias.
                if (!hasDomainAliasAlready) {
                    /**
                     * eg if domainAlias = 'Cdlx.org' and someone set hostsAlias = ['Cdlx.org/foo'] then we should
                     * not add Cdlx.org as it would increase the allowed scope.
                     */
                    configHostsAlias.push(domainAlias);
                }
            };
            this.enableCrossDomainLinking = function () {//tosee
                crossDomainTrackingEnabled = true;
            };

            /**
             * Disable cross domain linking if it was previously enabled. See enableCrossDomainLinking();
             */
            this.disableCrossDomainLinking = function () {//tosee
                crossDomainTrackingEnabled = false;
            };

            /**
             * Detect whether cross domain linking is enabled or not. See enableCrossDomainLinking();
             * @returns bool
             */
            this.isCrossDomainLinkingEnabled = function () {//tosee
                return crossDomainTrackingEnabled;
            };


            /**
             * By default, the two visits across domains will be linked together
             * when the link is click and the page is loaded within 180 seconds.
             * @param timeout in seconds
             */
            this.setCrossDomainLinkingTimeout = function (timeout) {//tosee
                configVisitorIdUrlParameterTimeoutInSeconds = timeout;
            };

            this.getCrossDomainLinkingUrlParameter = function () { //tosee
                return encodeWrapper(configVisitorIdUrlParameter) + '=' + encodeWrapper(getCrossDomainVisitorId());
            };

            /**
             * Set array of classes to be ignored if present in link
             *
             * @param string|array ignoreClasses
             */

            /**
             * Set request method
             *
             * @param string method GET or POST; default is GET
             */
            this.setRequestMethod = function (method) {
                configRequestMethod = method || defaultRequestMethod;
            };

            this.setRequestContentType = function (requestContentType) {
                configRequestContentType = requestContentType || defaultRequestContentType;
            };

            /**
             * Override referrer
             *
             * @param string url
             */
            this.setReferrerUrl = function (url) {
                configReferrerUrl = url;
            };

            /**
             * Override url
             *
             * @param string url
             */
            this.setCustomUrl = function (url) {
                configCustomUrl = resolveRelativeReference(locationHrefAlias, url);
            };

            /**
             * Returns the current url of the page that is currently being visited. If a custom URL was set, the
             * previously defined custom URL will be returned.
             */
            this.getCurrentUrl = function () {
                return configCustomUrl || locationHrefAlias;
            };

            /**
             * Override document.title
             *
             * @param string title
             */
            this.setDocumentTitle = function (title) {
                configTitle = title;
            };

            /**
             * Set the URL of the Cdlx API. It is used for Page Overlay.
             * This method should only be called when the API URL differs from the tracker URL.
             *
             * @param string apiUrl
             */
            this.setAPIUrl = function (apiUrl) {
                configApiUrl = apiUrl; //tosee
            };

            this.discardHashTag = function (enableFilter) {
                configDiscardHashTag = enableFilter;//tosee
            };

            /**
             * Set first-party cookie name prefix
             *
             * @param string cookieNamePrefix
             */
            this.setCookieNamePrefix = function (cookieNamePrefix) {
                configCookieNamePrefix = cookieNamePrefix;
                // Re-init the Custom Variables cookie
                customVariables = getCustomVariablesFromCookie();
            };

            /**
             * Set first-party cookie domain
             *
             * @param string domain
             */
            this.setCookieDomain = function (domain) {
                var domainFixed = domainFixup(domain);

                if (isPossibleToSetCookieOnDomain(domainFixed)) {
                    configCookieDomain = domainFixed;
                    updateDomainHash();
                }
            };

            /**
             * Get first-party cookie domain
             */
            this.getCookieDomain = function () {
                return configCookieDomain;
            };

            /**
             * Detect if cookies are enabled and supported by browser.
             */
            this.hasCookies = function () {
                return '1' === hasCookies();
            };

            /**
             * Set a first-party cookie for the duration of the session.
             *
             * @param string cookieName
             * @param string cookieValue
             * @param int msToExpire Defaults to session cookie timeout
             */
            this.setSessionCookie = function (cookieName, cookieValue, msToExpire) {
                if (!cookieName) {
                    throw new Error('Missing cookie name');
                }

                if (!isDefined(msToExpire)) {
                    msToExpire = configSessionCookieTimeout;
                }

                configCookiesToDelete.push(cookieName);

                setCookie(getCookieName(cookieName), cookieValue, msToExpire, configCookiePath, configCookieDomain);
            };

            /**
             * Get first-party cookie value.
             *
             * Returns null if cookies are disabled or if no cookie could be found for this name.
             *
             * @param string cookieName
             */
            this.getCookie = function (cookieName) {
                var cookieValue = getCookie(getCookieName(cookieName));

                if (cookieValue === 0) {
                    return null;
                }

                return cookieValue;
            };

            /**
             * Set first-party cookie path.
             *
             * @param string domain
             */
            this.setCookiePath = function (path) {
                configCookiePath = path;
                updateDomainHash();
            };

            /**
             * Get first-party cookie path.
             *
             * @param string domain
             */
            this.getCookiePath = function (path) {
                return configCookiePath;
            };

            /**
             * Set visitor cookie timeout (in seconds)
             * Defaults to 13 months (timeout=33955200)
             *
             * @param int timeout
             */
            this.setVisitorCookieTimeout = function (timeout) {
                configVisitorCookieTimeout = timeout * 1000;
            };

            /**
             * Set session cookie timeout (in seconds).
             * Defaults to 30 minutes (timeout=1800)
             *
             * @param int timeout
             */
            this.setSessionCookieTimeout = function (timeout) {
                configSessionCookieTimeout = timeout * 1000;
            };

            /**
             * Get session cookie timeout (in seconds).
             */
            this.getSessionCookieTimeout = function () {
                return configSessionCookieTimeout;
            };

            /**
             * Set referral cookie timeout (in seconds).
             * Defaults to 6 months (15768000000)
             *
             * @param int timeout
             */
            this.setReferralCookieTimeout = function (timeout) {
                configReferralCookieTimeout = timeout * 1000;
            };

            /**
             * Set conversion attribution to first referrer and campaign
             *
             * @param bool if true, use first referrer (and first campaign)
             *             if false, use the last referrer (or campaign)
             */
            this.setConversionAttributionFirstReferrer = function (enable) {
                configConversionAttributionFirstReferrer = enable;
            };

            /**
             * Enable the Secure cookie flag on all first party cookies.
             * This should be used when your website is only available under HTTPS
             * so that all tracking cookies are always sent over secure connection.
             *
             * @param bool
             */
            this.setSecureCookie = function (enable) {
                configCookieIsSecure = enable;
            };

            /**
             * Disables all cookies from being set
             *
             * Existing cookies will be deleted on the next call to track
             */
            this.disableCookies = function () {
                configCookiesDisabled = true;
                browserFeatures.cookie = '0';

                if (configTrackerSiteId) {
                    deleteCookies();
                }
            };

            /**
             * One off cookies clearing. Useful to call this when you know for sure a new visitor is using the same browser,
             * it maybe helps to "reset" tracking cookies to prevent data reuse for different users.
             */
            this.deleteCookies = function () {
                deleteCookies();
            };

            /**
             * Handle do-not-track requests
             *
             * @param bool enable If true, don't track if user agent sends 'do-not-track' header
             */
            this.setDoNotTrack = function (enable) {
                var dnt = navigatorAlias.doNotTrack || navigatorAlias.msDoNotTrack;
                configDoNotTrack = enable && (dnt === 'yes' || dnt === '1');

                // do not track also disables cookies and deletes existing cookies
                if (configDoNotTrack) {
                    this.disableCookies();
                }
            };

            this.enableJSErrorTracking = function () { //tosee
                if (enableJSErrorTracking) {
                    return;
                }

                enableJSErrorTracking = true;
                var onError = windowAlias.onerror;

                windowAlias.onerror = function (message, url, linenumber, column, error) {
                    trackCallback(function () {
                        var category = 'JavaScript Errors';

                        var action = url + ':' + linenumber;
                        if (column) {
                            action += ':' + column;
                        }

                        logEvent(category, action, message);
                    });

                    if (onError) {
                        return onError(message, url, linenumber, column, error);
                    }

                    return false;
                };
            };

            /**
             * Disable automatic performance tracking
             */
            this.disablePerformanceTracking = function () {
                configPerformanceTrackingEnabled = false;
            };
            this.setGenerationTimeMs = function (generationTime) {
                configPerformanceGenerationTime = parseInt(generationTime, 10);
            };

            this.getNumTrackedPageViews = function () {
                return numTrackedPageviews;
            };

            this.trackPageView = function (customTitle, customData, callback) {
                trackCallback(function () {
                    numTrackedPageviews++;
                    logPageView(customTitle, customData, callback);
                });

            };
            this.trackEvent = function (category, action, name, value, customData, callback) { //important rc
                trackCallback(function () {
                    logEvent(category, action, name, value, customData, callback);
                });
            };

            /**
             * Sends a tracking request with custom request parameters.
             * Cdlx will prepend the hostname and path to Cdlx, as well as all other needed tracking request
             * parameters prior to sending the request. Useful eg if you track custom dimensions via a plugin.
             *
             * @param request eg. "param=value&param2=value2"
             * @param customData
             * @param callback
             * @param pluginMethod
             */
            this.trackRequest = function (request, customData, callback, pluginMethod) {
                trackCallback(function () {
                    var fullRequest = getRequest(request, customData, pluginMethod);
                    sendRequest(fullRequest, configTrackerPause, callback);
                });
            };

            /**
             * Disables sending requests queued
             */
            this.disableQueueRequest = function () {
                requestQueue.enabled = false;
            };

            /**
             * Defines after how many ms a queued requests will be executed after the request was queued initially.
             * The higher the value the more tracking requests can be send together at once.
             */
            this.setRequestQueueInterval = function (interval) {
                if (interval < 1000) {
                    throw new Error('Request queue interval needs to be at least 1000ms');
                }
                requestQueue.interval = interval;
            };
            this.queueRequest = function (request) {
                trackCallback(function () {
                    var fullRequest = getRequest(request);
                    requestQueue.push(fullRequest);
                });
            };
            this.getRememberedConsent = function () {
                var value = getCookie(CONSENT_COOKIE_NAME);
                if (getCookie(CONSENT_REMOVED_COOKIE_NAME)) {
                    // if for some reason the consent_removed cookie is also set with the consent cookie, the
                    // consent_removed cookie overrides the consent one, and we make sure to delete the consent
                    // cookie.
                    if (value) {
                        deleteCookie(CONSENT_COOKIE_NAME, configCookiePath, configCookieDomain);
                    }
                    return null;
                }

                if (!value || value === 0) {
                    return null;
                }
                return value;
            };

            /**
             * Detects whether the user has given consent previously.
             *
             * @returns bool
             */
            this.hasRememberedConsent = function () {
                return !!this.getRememberedConsent();
            };

            this.requireConsent = function () {
                configConsentRequired = true;
                configHasConsent = this.hasRememberedConsent();
                // Cdlx.addPlugin might not be defined at this point, we add the plugin directly also to make JSLint happy
                // We also want to make sure to define an unload listener for each tracker, not only one tracker.
                coreConsentCounter++;
                plugins['CoreConsent' + coreConsentCounter] = {
                    unload: function () {
                        if (!configHasConsent) {
                            // we want to make sure to remove all previously set cookies again
                            deleteCookies();
                        }
                    }
                };
            };

            /**
             * Call this method once the user has given consent. This will cause all tracking requests from this
             * page view to be sent. Please note that the given consent won't be remembered across page views. If you
             * want to remember consent across page views, call {@link rememberConsentGiven()} instead.
             */
            this.setConsentGiven = function () {
                configHasConsent = true;
                deleteCookie(CONSENT_REMOVED_COOKIE_NAME, configCookiePath, configCookieDomain);
                var i, requestType;
                for (i = 0; i < consentRequestsQueue.length; i++) {
                    requestType = typeof consentRequestsQueue[i];
                    if (requestType === 'string') {
                        sendRequest(consentRequestsQueue[i], configTrackerPause);
                    } else if (requestType === 'object') {
                        sendBulkRequest(consentRequestsQueue[i], configTrackerPause);
                    }
                }
                consentRequestsQueue = [];
            };
            this.rememberConsentGiven = function (hoursToExpire) {
                if (configCookiesDisabled) {
                    logConsoleError('rememberConsentGiven is called but cookies are disabled, consent will not be remembered');
                    return;
                }
                if (hoursToExpire) {
                    hoursToExpire = hoursToExpire * 60 * 60 * 1000;
                }
                this.setConsentGiven();
                var now = new Date().getTime();
                setCookie(CONSENT_COOKIE_NAME, now, hoursToExpire, configCookiePath, configCookieDomain, configCookieIsSecure);
            };

            this.forgetConsentGiven = function () {
                if (configCookiesDisabled) {
                    logConsoleError('forgetConsentGiven is called but cookies are disabled, consent will not be forgotten');
                    return;
                }

                var thirtyYears = 30 * 365 * 24 * 60 * 60 * 1000;

                deleteCookie(CONSENT_COOKIE_NAME, configCookiePath, configCookieDomain);
                setCookie(CONSENT_REMOVED_COOKIE_NAME, new Date().getTime(), thirtyYears, configCookiePath, configCookieDomain, configCookieIsSecure);
                this.requireConsent();
            };

            /**
             * Returns true if user is opted out, false if otherwise.
             *
             * @returns {boolean}
             */
            this.isUserOptedOut = function () {
                return !configHasConsent;
            };

            /**
             * Alias for forgetConsentGiven(). After calling this function, the user will no longer be tracked,
             * (even if they come back to the site).
             */
            this.optUserOut = this.forgetConsentGiven;

            /**
             * Alias for rememberConsentGiven(). After calling this function, the current user will be tracked.
             */
            this.forgetUserOptOut = this.rememberConsentGiven;

            Cdlx.trigger('TrackerSetup', [this]);
        }
        function TrackerProxy() {
            return {
                push: apply
            };
        }

        /**
         * Applies the given methods in the given order if they are present in cdlxmain.
         *
         * @param {Array} cdlxmain
         * @param {Array} methodsToApply an array containing method names in the order that they should be applied
         *                 eg ['setSiteId', 'setTrackerUrl']
         * @returns {Array} the modified cdlxmain array with the methods that were already applied set to undefined
         */
        function applyMethodsInOrder(cdlxmain, methodsToApply) {
            var appliedMethods = {};
            var index, iterator;

            for (index = 0; index < methodsToApply.length; index++) {
                var methodNameToApply = methodsToApply[index];
                appliedMethods[methodNameToApply] = 1;

                for (iterator = 0; iterator < cdlxmain.length; iterator++) {
                    if (cdlxmain[iterator] && cdlxmain[iterator][0]) {
                        var methodName = cdlxmain[iterator][0];

                        if (methodNameToApply === methodName) {
                            apply(cdlxmain[iterator]);
                            delete cdlxmain[iterator];

                            if (appliedMethods[methodName] > 1
                                && methodName !== "addTracker") {
                                logConsoleError('The method ' + methodName + ' is registered more than once in "_cdlxmain" variable. Only the last call has an effect. Please have a look at the multiple Cdlx trackers documentation: https://developer.Cdlx.org/guides/tracking-javascript-guide#multiple-Cdlx-trackers');
                            }

                            appliedMethods[methodName]++;
                        }
                    }
                }
            }

            return cdlxmain;
        }

        var applyFirst = ['addTracker', 'disableCookies', 'setTrackerUrl', 'setAPIUrl', 'enableCrossDomainLinking', 'setCrossDomainLinkingTimeout', 'setSessionCookieTimeout', 'setVisitorCookieTimeout', 'setSecureCookie', 'setCookiePath', 'setCookieDomain', 'setDomains', 'setUserId', 'setSiteId', 'alwaysUseSendBeacon', 'enableLinkTracking', 'requireConsent', 'setConsentGiven'];

        function createFirstTracker(cdlxUrl, siteId) //very important rc
        {
            var tracker = new Tracker(cdlxUrl, siteId);
            asyncTrackers.push(tracker);

            _cdlxmain = applyMethodsInOrder(_cdlxmain, applyFirst);

            // apply the queue of actions
            for (iterator = 0; iterator < _cdlxmain.length; iterator++) {
                if (_cdlxmain[iterator]) {
                    apply(_cdlxmain[iterator]);
                }
            }

            // replace initialization array with proxy object
            _cdlxmain = new TrackerProxy();

            Cdlx.trigger('TrackerAdded', [tracker]);

            return tracker;
        }

        Cdlx = {
            initialized: false,

            JSON: JSON,

            /**
             * DOM Document related methods
             */
            DOM: {
                /**
                 * Adds an event listener to the given element.
                 * @param element
                 * @param eventType
                 * @param eventHandler
                 * @param useCapture  Optional
                 */
                addEventListener: function (element, eventType, eventHandler, useCapture) {
                    var captureType = typeof useCapture;
                    if (captureType === 'undefined') {
                        useCapture = false;
                    }

                    addEventListener(element, eventType, eventHandler, useCapture);
                },
                /**
                 * Specify a function to execute when the DOM is fully loaded.
                 *
                 * If the DOM is already loaded, the function will be executed immediately.
                 *
                 * @param function callback
                 */
                onLoad: trackCallbackOnLoad,

                /**
                 * Specify a function to execute when the DOM is ready.
                 *
                 * If the DOM is already ready, the function will be executed immediately.
                 *
                 * @param function callback
                 */
                onReady: trackCallbackOnReady
            },

            /**
             * Listen to an event and invoke the handler when a the event is triggered.
             *
             * @param string event
             * @param function handler
             */
            on: function (event, handler) { //when it is used rc
                if (!eventHandlers[event]) {
                    eventHandlers[event] = [];
                }

                eventHandlers[event].push(handler);
            },

            /**
             * Remove a handler to no longer listen to the event. Must pass the same handler that was used when
             * attaching the event via ".on".
             * @param string event
             * @param function handler
             */
            off: function (event, handler) {
                if (!eventHandlers[event]) {
                    return;
                }

                var i = 0;
                for (i; i < eventHandlers[event].length; i++) {
                    if (eventHandlers[event][i] === handler) {
                        eventHandlers[event].splice(i, 1);
                    }
                }
            },

            /**
             * Triggers the given event and passes the parameters to all handlers.
             *
             * @param string event
             * @param Array extraParameters
             * @param Object context  If given the handler will be executed in this context
             */
            trigger: function (event, extraParameters, context) {
                if (!eventHandlers[event]) {
                    return;
                }

                var i = 0;
                for (i; i < eventHandlers[event].length; i++) {
                    eventHandlers[event][i].apply(context || windowAlias, extraParameters);
                }
            },

            /**
             * Add plugin
             *
             * @param string pluginName
             * @param Object pluginObj
             */
            addPlugin: function (pluginName, pluginObj) {
                plugins[pluginName] = pluginObj;
            },

            /**
             * Get Tracker (factory method)
             *
             * @param string cdlxUrl
             * @param int|string siteId
             * @return Tracker
             */
            getTracker: function (cdlxUrl, siteId) {
                if (!isDefined(siteId)) {
                    siteId = this.getAsyncTracker().getSiteId();
                }
                if (!isDefined(cdlxUrl)) {
                    cdlxUrl = this.getAsyncTracker().getTrackerUrl();
                }

                return new Tracker(cdlxUrl, siteId);
            },

            /**
             * Get all created async trackers
             *
             * @return Tracker[]
             */
            getAsyncTrackers: function () {
                return asyncTrackers;
            },

            /**
             * Adds a new tracker. All sent requests will be also sent to the given siteId and cdlxUrl.
             * If cdlxUrl is not set, current url will be used.
             *
             * @param null|string cdlxUrl  If null, will reuse the same tracker URL of the current tracker instance
             * @param int|string siteId
             * @return Tracker
             */
            addTracker: function (cdlxUrl, siteId) {
                var tracker;
                if (!asyncTrackers.length) {
                    tracker = createFirstTracker(cdlxUrl, siteId);
                } else {
                    tracker = asyncTrackers[0].addTracker(cdlxUrl, siteId);
                }
                return tracker;
            },

            /**
             * Get internal asynchronous tracker object.
             *
             * If no parameters are given, it returns the internal asynchronous tracker object. If a cdlxUrl and idSite
             * is given, it will try to find an optional
             *
             * @param string cdlxUrl
             * @param int|string siteId
             * @return Tracker
             */
            getAsyncTracker: function (cdlxUrl, siteId) {

                var firstTracker;
                if (asyncTrackers && asyncTrackers.length && asyncTrackers[0]) {
                    firstTracker = asyncTrackers[0];
                } else {
                    return createFirstTracker(cdlxUrl, siteId);
                }

                if (!siteId && !cdlxUrl) {
                    // for BC and by default we just return the initially created tracker
                    return firstTracker;
                }

                // we look for another tracker created via `addTracker` method
                if ((!isDefined(siteId) || null === siteId) && firstTracker) {
                    siteId = firstTracker.getSiteId();
                }

                if ((!isDefined(cdlxUrl) || null === cdlxUrl) && firstTracker) {
                    cdlxUrl = firstTracker.getTrackerUrl();
                }

                var tracker, i = 0;
                for (i; i < asyncTrackers.length; i++) {
                    tracker = asyncTrackers[i];
                    if (tracker
                        && String(tracker.getSiteId()) === String(siteId)
                        && tracker.getTrackerUrl() === cdlxUrl) {

                        return tracker;
                    }
                }
            }
        };

        return Cdlx;
    }());
}

(function () { //tosee
    'use strict';

    function hascdlxmainConfiguration() {
        if ('object' !== typeof _cdlxmain) {
            return false;
        }
        // needed to write it this way for jslint
        var lengthType = typeof _cdlxmain.length;
        if ('undefined' === lengthType) {
            return false;
        }

        return !!_cdlxmain.length;
    }

    if (!window.Cdlx.getAsyncTrackers().length) {
            window.Cdlx.addTracker();
    }
    window.Cdlx.trigger('PiwikInitialized', []);
    window.Cdlx.initialized = true;
}());
