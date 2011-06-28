/*global window,chrome,jQuery,document,console,io */
"use strict";  // voices in my head forced me to write this

var Hypno = {
    params: {
        debug  : false,
        version: -1
    },

    auth_and_reg: false,    // this flag shows that we have
                            // Auth (on google) and Registration on Android

    // console.log wrapper then only spams in debug mode
    log: function(o) {
        if (Hypno.params.debug&&window.console&&console.log) {
            console.log(o);
        }
    },
    // console.log wrapper then only spams in debug mode
    warn: function(o) {
        if (window.console&&console.warn) {
            console.warn(o);
        }
    },
    // console.log wrapper then only spams in debug mode
    error: function(o) {
        if (window.console&&console.error) {
            console.error(o);
        }
    },

    Init: function(params) {
        Hypno.params  = params;

        // initializing urls
        Hypno.Urls.Init();

        // add listener to communicate with popup page
        chrome.extension.onRequest.addListener(
            function(request, sender, sendResponse) {

                if (!request.hasOwnProperty('action')) {
                    Hypno.log('UI: request without action detected. Ignoring');
                    return false;
                }

                switch(request.action) {
                case 'bg_send_sms':
                    Hypno.Messages.Send(request.data);
                    break;

                case 'bg_mark_as_read':
                    Hypno.Messages.MarkAsRead(request.data);
                    break;

                case 'bg_log':
                    if (request.hasOwnProperty('type')) {
                        switch (request.type) {
                        case 'info':
                            Hypno.log(request.data);
                            break;
                        case 'warn':
                            Hypno.warn(request.data);
                            break;
                        case 'error':
                            Hypno.error(request.data);
                            break;
                        }
                    } else {
                        Hypno.warn('Got log request without type definition:');
                        Hypno.warn(request.data);
                    }
                    break;

                case 'bg_get_contact_list':
                    // send signal to main window with contact list
                    chrome.extension.sendRequest({
                                                     action: 'ui_reload_contacts',
                                                     data: Hypno.Contacts.list
                                                 });
                    break;

                case 'bg_get_messages':
                    // send signal to main window with contact list
                    chrome.extension.sendRequest({
                                                     action: 'ui_reload_messages',
                                                     data: Hypno.Messages.list
                                                 });
                    break;

                case 'bg_reload_messages':
                    Hypno.Messages.Load();
                    break;

                case 'bg_load_dialog':
                    Hypno.Messages.LoadDialog(request.cid);
                    break;

                case 'bg_reload_data':
                    Hypno.Contacts.Load();
                    Hypno.Messages.Load();
                    break;

                case 'bg_signout':
                    Hypno.Actions.Signout();
                    break;

                case 'bg_checkAuthReg':
                    Hypno.Actions.checkAuthAndReg();
                    break;

                case 'bg_dialog_inactive':
                    Hypno.Contacts.active_dialog = false;
                    break;

                case 'bg_dialog_active':
                    Hypno.Contacts.active_dialog = request.data;
                    break;

                default:
                    Hypno.log('ENGINE: ~~~> got signal '+request.action);
                    break;
                }
            }
        );

        chrome.browserAction.setPopup({
            popup: "hypno_gui.html"
        });

        // get user email and fio
        jQuery.when(
            jQuery.ajax({
                            url: Hypno.Urls.status,
                            dataType: 'json'
                        })
        ).done(
            function(res) {
                if (!(typeof(res) === "object" && res.hasOwnProperty('status'))) {
                    Hypno.warn(res);
                    return false;
                }
                // check status
                Hypno.Actions.checkStatus(res.status);
                // save username and email
                Hypno.params.userid     = res.email;
                Hypno.params.username   = res.nickName;
                Hypno.params.userkey    = '123456789'; // TO BE FIXED one day  // TODO FIXME
                if (Hypno.auth_and_reg) {
                    Hypno.Contacts.Load();
                    Hypno.ws.init();
                }
                return true;
            });
        return true;
    },

    Actions: {
        // this function is called from gui
        // every time a popup is open
        // it just check then we have auth and reg
        checkAuthAndReg: function() {
            jQuery.ajax({
                url: Hypno.Urls.status,
                dataType: 'json',
                complete: function(res) {
                    var json;
                    try {
                        //json = eval('('+res.responseText+')');  // obj = this.getResponseJSON();
                        json = JSON.parse(res.responseText);
                    } catch (err) {
                        Hypno.warn(err);
                        return false;
                    }
                    Hypno.Actions.checkStatus(json.status);
                    return true;
                }
                        });
        },

        checkStatus: function(status) {
            var result = false;
            switch (status) {
            case 'OK':
                var stored_status = window.localStorage.getItem('Hypno_status');
                if (stored_status != 'ok' || !Hypno.auth_and_reg) {
                    Hypno.Actions.Registered();
                }
                result = true;
                break;

            case 'DEVICE_NOT_REGISTERED':
                Hypno.Actions.DeviceNotRegistered();
                break;

            case 'SIGNIN_REQUIRED':
                Hypno.Actions.NotAuthorized();
                Hypno.Actions.Signout();
                break;

            default:
                Hypno.error('ENGINE: UNKNOWN STATUS '+status);
            }
            return result;
        },

        Signout: function() {
            Hypno.log('ENGINE: Signout called. All data cleared');
            Hypno.Notifications.Icon('auth');
            window.localStorage.setItem('Hypno_status', 'auth');
            Hypno.Contacts.list = [];
        },

        MessageSent: function(request) {
            Hypno.Messages.Store();
            chrome.extension.sendRequest({action: 'ui_message_sent'});
        },

        NewMessagesAvailable: function() {
            window.localStorage.setItem('Hypno_status', 'ok');
            if (Hypno.Messages.list && Hypno.Messages.list.length > 0) {
                Hypno.Notifications.Icon('new', Hypno.Messages.list.length);
            } else {
                Hypno.Notifications.Icon('clear');
            }
        },

        DeviceNotRegistered: function() {
            Hypno.log('ENGINE: ... DEVICE_NOT_REGISTERED');
            Hypno.auth_and_reg = false;
            Hypno.Notifications.Icon('register');
            window.localStorage.setItem('Hypno_status', 'device_not_registered');
            chrome.extension.sendRequest({action: 'ui_not_registered'});
            // clear event listeners
            chrome.browserAction.onClicked.listeners = [];
        },

        Registered: function() {
            Hypno.log('ENGINE: ... DEVICE_REGISTERED!');
            Hypno.auth_and_reg = true;
            Hypno.Notifications.Icon('new', Hypno.Messages.list.length);
            window.localStorage.setItem('Hypno_status', 'ok');
            chrome.extension.sendRequest({action: 'ui_registered'});
        },

        NotAuthorized: function() {
            Hypno.log('ENGINE: ... SIGNIN_REQUIRED');
            Hypno.auth_and_reg = false;
            Hypno.Notifications.Icon('auth');
            window.localStorage.setItem('Hypno_status', 'auth');

            // clear event listeners
            chrome.browserAction.onClicked.listeners = [];
        }
    },

    Notifications: {
        desktop_popup: false,

        // Shows desktop notification
        Popup: function(msg) {
            if (!msg) return 0; // we only display usefull popups :)

            if (window.webkitNotifications.checkPermission() === 0) { // 0 is PERMISSION_ALLOWED

                Hypno.Notifications.desktop_popup = window.webkitNotifications.createNotification(
                    'img/icon_120.png',
                    chrome.i18n.getMessage('_new_sms_notify'),
                    msg
                );
                Hypno.Notifications.desktop_popup.show();

                // remove notification
                window.setTimeout(
                    function(){
                        // we check if user have already closed popup
                        if (Hypno.Notifications.desktop_popup) {
                            Hypno.Notifications.desktop_popup.cancel();
                            Hypno.Notifications.desktop_popup = false;
                        }
                    }, 4000);

            } else {
                window.webkitNotifications.requestPermission();
            }
            return true;
        },

        Icon: function(action, msg) {
            //Hypno.log('ENGINE: Notify.Icon called action='+action);
            if (action == 'new') {
                chrome.browserAction.setIcon({path: "img/icon_18.png"});
                // don't draw 0 sms
                if (msg === 0) {
                    chrome.browserAction.setBadgeText({text: ''});
                    return 1;
                }
                chrome.browserAction.setBadgeText({text: String(msg)});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_new_messages')});
            }
            if (action == 'auth') {
                chrome.browserAction.setIcon({path: "img/icon_18_disabled.png"});
                chrome.browserAction.setBadgeText({text: 'A'});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_authorization_fail')});
            }
            if (action == 'register') {
                chrome.browserAction.setIcon({path: "img/icon_18_disabled.png"});
                chrome.browserAction.setBadgeText({text: '!'});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_not_registered')});
            }
            if (action == 'clear') {
                chrome.browserAction.setIcon({path: "img/icon_18.png"});
                chrome.browserAction.setBadgeText({text: ''});
                chrome.browserAction.setTitle({title: chrome.i18n.getMessage('_icon_new_messages')});
            }
            return true;
        }
    },

    Messages: {
        iniated: false,

        // incoming sms messages
        list: [],

        // holds active dialog
        active_dialog: [],

        LoadDialog: function(cid) {

            var contact = Hypno.Contacts.list[Hypno.Contacts.FindById(cid)];
            var phones  = [];
            if (contact && contact.phones && contact.phones.length > 0) {
                for (var i = contact.phones.length-1; i >= 0; i--) {
                    phones.push(contact.phones[i].number);
                }
            }
            var phones_numbers = phones.join(',');

            // Drawing messages
            jQuery.when(
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.unread+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                                dataType: 'json'
                            }),
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.outgoing+'&phone_numbers='+encodeURIComponent(phones_numbers)+'&from=0&to=20',
                                dataType: 'json'

                            })
            ).done(
                function(ajax1, ajax2){
                    // the problem here is that both lists are not sorted.
                    // so we can try to concat them and then sort
                    var list = ajax1[0].sms_list.slice().concat(ajax2[0].message_list.slice());

                    // Copyright Douglas Crockford
                    var by = function(name){
                        return function(o, p) {
                            var a, b;
                            if (typeof o === 'object' && typeof p === 'object' && o && p) {
                                a = o[name];
                                b = p[name];
                                if (a === b){
                                    return 0;
                                }
                                if (typeof a === typeof b){
                                    return a < b ? -1 : 1;
                                }
                                return typeof a < typeof b ? -1 : 1;

                            } else {
                                throw {
                                    name: "Error",
                                    message: 'i want object with property '+name
                                };
                            }
                        };
                    };

                    Hypno.Messages.active_dialog = list.sort(by('create_time')).reverse();
                    chrome.extension.sendRequest({
                                                     action: 'ui_reload_dialog',
                                                     cid: cid,
                                                     data: Hypno.Messages.active_dialog
                                                 });
                });

        },

        Load: function(){

            if (!Hypno.Messages.iniated) {
                Hypno.Messages.iniated = true;
            }

            jQuery.when(
                jQuery.ajax({
                                url: Hypno.Urls.messages.get.unread+'&status=0',
                                dataType: 'json'
                            })
            ).done(function(ajax_new_list){
                       if (!Hypno.Actions.checkStatus(ajax_new_list.status)) {
                           Hypno.warn('ENGINE: status FAIL');
                           return false;
                       }

                       var new_sms = ajax_new_list.sms_list.slice();
                       Hypno.Actions.NewMessagesAvailable();

                       // generating virtual contacts
                       Hypno.Contacts.GenerateVirtualContacts(new_sms);
                       // TODO FIXME
                       // do we really need above? Maybe we should send contacts to UI here ?


                       // handling of new messages
                       if (Hypno.Messages.list != new_sms) {
                           Hypno.Messages.list = new_sms.slice();

                           // generating virtual contacts
                           Hypno.Contacts.GenerateVirtualContacts();
                           Hypno.Actions.NewMessagesAvailable();

                           chrome.extension.sendRequest({
                                                            action: 'ui_reload_messages',
                                                            data: Hypno.Messages.list
                                                        });
                           chrome.extension.sendRequest({
                                                            action: 'ui_reload_contacts',
                                                            data: Hypno.Contacts.list
                                                        });
                       }
                       return true;
                   });
        },

        /*
         Receive a list of messages ids and move them from list to copy2list
         */
        RemoveById: function(id_arr) {
            var list = Hypno.Messages.list;
            var a,l,max,max2;
            if (id_arr instanceof Array && id_arr.length > 0) {
                for (a = 0, max = id_arr.length; a < max; a++) {
                    for (l = 0, max2 = list.length; l < max2; l++) {
                        if (list[l].id == id_arr[a]) {
                            list.splice(l, 1);
                            break;
                        }
                    }
                }
            }
            return list;
        },

        MarkAsRead: function(id_arr) {
            // we can mark all messages as read if pass any string instead of array
            if (id_arr.constructor != Array ) {
                id_arr = [];
                var list = Hypno.Messages.list;
                for (var i = 0, max = list.length; i < max; i++) {
                    if (list[i].hasOwnProperty('id') && list[i].status != 30)
                        id_arr.push(list[i].id);
                }
            } else {
                Hypno.log('UI: Marking as read id='+id_arr.join(','));
            }

            Hypno.Messages.list = Hypno.Messages.RemoveById(id_arr);

            jQuery.ajax({
                            url: Hypno.Urls.messages.set.read+id_arr.join(','),
                            dataType: 'json',
                            complete: function(data) {
                                Hypno.Notifications.Icon('new', Hypno.Messages.list.length);
                                chrome.extension.sendRequest({
                                                                 action: 'ui_reload_messages',
                                                                 data: Hypno.Messages.list
                                                             });
                                // send signal to UI to update lists
                                chrome.extension.sendRequest({
                                                                 action: 'ui_reload_contacts',
                                                                 data: Hypno.Contacts.list
                                                             });
                            }
                        });
        },

        Send: function(msg) {
            var send_url = Hypno.Urls.send+
                '&collapse_key='+msg.collapse_key+
                '&phone_number='+encodeURIComponent(msg.phone_number)+
                '&message='+encodeURIComponent(msg.message);

            jQuery.ajax({
                            url: send_url,
                            dataType: 'json',
                            complete: function (data) {
                                var json = {};
                                try {
                                    json = JSON.parse(data.responseText);
                                } catch (err) {
                                    Hypno.warn(err);
                                    return false;
                                }

                                if (Hypno.Actions.checkStatus(json.status)) {

                                    // saving message to dialog
                                    Hypno.Messages.active_dialog.unshift({
                                                                             create_time: new Date().getTime(),
                                                                             collapse_key: msg.collapse_key,
                                                                             message: msg.message,
                                                                             phone_number: msg.phone_number,
                                                                             status: 30
                                                                         });

                                    chrome.extension.sendRequest({
                                                                     action : 'ui_message_sent'
                                                                 });

                                    chrome.extension.sendRequest({
                                                                     action: 'ui_reload_dialog',
                                                                     cid: msg.cid,
                                                                     data: Hypno.Messages.active_dialog
                                                                 });

                                }
                                return true;
                            }
                        });

        }
    },

    Contacts: {
        list            : [],
        phones_lookup   : false,
        active_dialog   : false,

        FindById: function(id) {
            for (var i = 0, max = Hypno.Contacts.list.length; i < max; i++) {
                if (Hypno.Contacts.list[i].id == id) {
                    return i;
                }
            }
            return -1;
        },

        RebuildLookup: function() {
            var lookup   = {};
            var list = Hypno.Contacts.list;
            for (var i = 0; i < list.length; i++) {
                for (var j = 0; j < list[i].phones.length; j++) {
                    lookup[list[i].phones[j].number] = i;
                }
            }
            Hypno.Contacts.phones_lookup = lookup;
        },

        FindByPhone: function(phone) {
            var lookup = Hypno.Contacts.phones_lookup;

            if (!lookup) {
                Hypno.Contacts.RebuildLookup();
            }
            if (!phone) return -1;
            return lookup[phone];
        },

        // this function will parse all incoming messages and search for
        // senders that are not in the contact list
        GenerateVirtualContacts: function(messages, contacts) {
            // reseting lookup
            Hypno.Contacts.phones_lookup = false;

            var msgs = messages || Hypno.Messages.list;
            var ctcs = contacts || Hypno.Contacts.list;

            if (!msgs) {
                Hypno.log('Warning! no messages found. Can\'t generate virtual contacts');
                return 0;
            }

            if (!ctcs) {
                Hypno.log('Warning! no contacts found. Can\'t generate virtual contacts');
                return 0;
            }

            /*
             contact format
             ---------------
             id   : string/number
             name : string
             phones: array[{ number: string, primary: boolean, type: int } ]
             */
            for (var i = 0; i < msgs.length; i++) {
                if (!Hypno.Contacts.FindByPhone(msgs[i].phone_number)) {
                    Hypno.Contacts.list.push({
                        id  : 'virt'+Math.floor(Math.random()*11)+Math.floor(Math.random()*5)+(new Date().getTime()), // trying to be random :(
                        name: msgs[i].phone_number,
                        phones: [{
                                     number  : msgs[i].phone_number,
                                     primary : true,
                                     type    : 2 // could be any type here
                                 }]
                    });
                    Hypno.Contacts.phones_lookup[msgs[i].phone_number] = Hypno.Contacts.list.length-1;
                }
            }

            return 1;
        },

        Load: function() {
            //Hypno.log('ENGINE: ... Contacts sending request');
            jQuery.ajax({
                            url: Hypno.Urls.contacts,
                            dataType: 'json',
                            complete: function(data) {
                                var json = {};
                                try {
                                    json = JSON.parse(data.responseText);
                                } catch (err) {
                                    Hypno.warn(err);
                                    return false;
                                }

                                if (Hypno.Actions.checkStatus(json.status)) {

                                    if (!Hypno.auth_and_reg) {
                                        Hypno.Actions.Registered(); // ? do we really need this ?
                                    }

                                    if (Hypno.Contacts.list != json.contact_list) {
                                        Hypno.log('<== got new contacts list');
                                        Hypno.Contacts.list = json.contact_list.slice();

                                        // generating virtual contacts
                                        Hypno.Contacts.GenerateVirtualContacts();

//                                        window.localStorage.setItem('Hypno_status', 'ok');

                                        // send signal to main window to update contacts list
                                        chrome.extension.sendRequest({
                                                                         action: 'ui_reload_contacts',
                                                                         data: Hypno.Contacts.list
                                                                     });

                                    }

                                    // getting messages from server
                                    if (!Hypno.Messages.iniated) {
                                        Hypno.Messages.Load();
                                    }
                                }
                                return true;
                            }
                        });
        }
    },

    Urls: {
        appEngine   : false,
        signIn      : false,
        signOut     : false,
        contacts    : false,
        send        : false,
        index       : chrome.extension.getURL('close.html'),
        websocket   : {
            port: 80,
            host: false
        },

        Init: function() {
            Hypno.Urls.appEngine   = "http://"+Hypno.params.version+".latest.bandog812.appspot.com/";
            Hypno.Urls.signIn      = Hypno.Urls.appEngine+"sign?action=signin&extret="+encodeURIComponent(Hypno.Urls.index)+"&ver="+Hypno.params.version;
            Hypno.Urls.signOut     = Hypno.Urls.appEngine+"sign?action=signout&extret=OK&ver="+Hypno.params.version;
            Hypno.Urls.status      = Hypno.Urls.appEngine+"sign?action=check&ver="+Hypno.params.version;
            Hypno.Urls.contacts    = Hypno.Urls.appEngine+"contacts_list?action=get&ver="+Hypno.params.version;
            Hypno.Urls.send        = Hypno.Urls.appEngine+"message?action=send&ver="+Hypno.params.version;
            Hypno.Urls.send_status = Hypno.Urls.appEngine+"message?action=get_status&ver="+Hypno.params.version+'&collapse_key=';
            Hypno.Urls.websocket.port = Hypno.params.ws_port;
            Hypno.Urls.websocket.host = Hypno.params.ws_host;

            Hypno.Urls.messages = {
                'get': {
                    unread  : Hypno.Urls.appEngine+"sms?action=get&ver="+Hypno.params.version,
                    viewed  : Hypno.Urls.appEngine+"sms?action=get&status=30&from=0&to=10&ver="+Hypno.params.version,
                    outgoing: Hypno.Urls.appEngine+'message?action=get&ver='+Hypno.params.version
                },
                'set': {
                    'read'  : Hypno.Urls.appEngine+"sms?action=update_status&ver="+Hypno.params.version+"&status=30&id="
                }
            };
        }
    },

    // websocket layer
    ws: {
        socket: false,
        debug : false,
        auth  : false,
        params: {},

        // Connection Manager. Can initiate WS connection,
        // send messages
        // and authorize client on server
        conn: {
            init: function() {
                if (Hypno.ws.socket) {
                    Hypno.log('already connected to socket');
                    return 0;
                }
                try {
                    Hypno.ws.socket = new io.Socket(Hypno.Urls.websocket.host, {
                                                        port: Hypno.Urls.websocket.port,
                                                        rememberTransport: true
                                                    });
                    Hypno.ws.socket.connect();
                } catch(e) {
                    Hypno.log('error connecting to socket');
                    Hypno.log(e);
                    return 0;
                }
                Hypno.ws.bind_handlers();     // binding response handlers
                return 1;
            },

            // checks for auth.
            // if called without params - will try to send auth request
            //
            auth: function(msg) {
                if (!msg) {
                    Hypno.log('---> sending auth request');
                    Hypno.ws.conn.send({
                                           type: 'auth',
                                           key : Hypno.params.userkey,
                                           id  : Hypno.params.userid,
                                           sid : 'websms'
                                       });
                } else {
                    if (msg.hasOwnProperty('type') && msg.type == 'auth') {
                        if (msg.data.hasOwnProperty('value') && msg.data.value) {
                            Hypno.ws.auth = true;
                            Hypno.log('Auth granted');
                        } else {
                            Hypno.ws.auth = false;
                            Hypno.log('Auth rejected');
                        }
                    } else {
                        Hypno.log('Warning: can\'t parser auth response');
                        Hypno.log(msg);
                    }
                }
            },

            // sending data to server over ws
            send: function(o) {
                try {
                    Hypno.ws.socket.send(o);
                } catch(e) {
                    Hypno.log(e);
                }
                return 1;
            }
        },

        bind_handlers: function() {
            //Hypno.log('binding handlers');
            // binding handlers
            Hypno.ws.socket.on(
                'message',
                function(msg){
                    if (msg.hasOwnProperty('type')) {
                        switch (msg.type) {
                        case 'auth':
                            Hypno.log('<--- AUTH response');
                            Hypno.ws.conn.auth(msg);
                            return 1;

                        case 'SMS':
                            Hypno.log('<--- SMS');
                            Hypno.ws.notify.sms(msg);
                            return 1;

                        case 'MESSAGE':
                            Hypno.log('<--- MESSAGE');
                            Hypno.ws.notify.message(msg);
                            return 1;

                        case 'SMS_STATUS_CHANGED':
                            // do nothing;
                            break;

                        case 'MESSAGE_STATUS_CHANGED':
                            Hypno.log('<--- SMS/MSG STATUS CHANGED');
                            Hypno.ws.notify.status_update(msg);
                            break;

                        case 'CONTACT_LIST':
                            Hypno.log('<--- CONTACT_LIST');
                            Hypno.ws.notify.contact_list(msg);
                            break;

                        case 'DEVICE_REGISTERED':
                            Hypno.log('<--- DEV_REGISTERED');
                            Hypno.ws.notify.registered(msg);
                            break;

                        case 'DEVICE_NOT_REGISTERED':
                            Hypno.log('<--- DEV_NOT_REGISTERED');
                            Hypno.ws.notify.not_registered(msg);
                            break;

                        default:
                            Hypno.log('<--- unknown message');
                            Hypno.log(msg);
                            break;
                        }
                    } else {
                        Hypno.log('Warning: message doesn\'t has type. Don\'t know how to parse');
                        Hypno.log(msg);
                        return 0;
                    }
                });

            Hypno.ws.socket.on(
                'connect',
                function(){
                    Hypno.log('~~~ websocket connected');
                    Hypno.ws.conn.auth();         // requesting auth
                });

            Hypno.ws.socket.on(
                'disconnect',
                function() {
                    Hypno.log('~~~  websocket disconnected');
                    Hypno.ws.auth = false;
                });

            //Hypno.ws.socket.on('reconnect', function(){ message({ message: ['System', 'Reconnected to server']})});
            //Hypno.ws.socket.on('reconnecting', function( nextRetry ){ message({ message: ['System', 'Attempting to re-connect to the server, next attempt in ' + nextRetry + 'ms']})});
            //Hypno.ws.socket.on('reconnect_failed', function(){ message({ message: ['System', 'Reconnected to server FAILED.']})});
        },

        // handling of all notifications
        notify: {

            // handling of new sms notifications
            sms: function(msg) {
                // message data contaions full sms
                try {
                    msg = JSON.parse(msg.data);
                } catch (x) {
                    Hypno.error('Cannot parse new incoming sms message. Not a proper JSON format');
                    Hypno.error(msg);
                    return false;
                }

                // saving new sms into list
                Hypno.Messages.list.unshift(msg);

                // send message to UI instead of storing into local storage
                //Hypno.Messages.Store();


                var cid  = Hypno.Contacts.FindByPhone(msg.phone_number);
                var name = msg.phone_number;

                if (cid > -1) {
                    // we found contact
                    name = Hypno.Contacts.list[cid].name;
                } else {
                    // we need to reset contacts lookup so it will be rebuilded
                    Hypno.Contacts.GenerateVirtualContacts();
                    cid = Hypno.Contacts.FindByPhone(msg.phone_number);
                }

                Hypno.Notifications.Popup(chrome.i18n.getMessage('_new_sms_notify_label')+' '+name);

                // send signal to UI
                Hypno.Actions.NewMessagesAvailable();
                chrome.extension.sendRequest({
                                                 action: 'ui_reload_messages',
                                                 data: Hypno.Messages.list
                                             });
                chrome.extension.sendRequest({
                                                 action: 'ui_reload_contacts',
                                                 data: Hypno.Contacts.list
                                             });

                // if we got active dialog - we should update it
                if (Hypno.Contacts.active_dialog) {
                    if (Hypno.Contacts.active_dialog.indexOf(msg.phone_number) != -1) {
                        Hypno.log(' **************** got active dialog! Reloading... for cid='+cid+' user='+msg.data);
                        // injecting sms message into dialog
                        Hypno.Messages.active_dialog.unshift(msg);
                        var contact_id = Hypno.Contacts.list[cid].id;
                        chrome.extension.sendRequest({
                                                         action: 'ui_reload_dialog',
                                                         cid: contact_id,
                                                         noreload: 1,
                                                         data: Hypno.Messages.active_dialog
                                                     });

                    } else {
                        Hypno.log('active dialog with '+Hypno.Contacts.active_dialog+' but sms is from '+ msg.data);
                    }
                }
            },

            status_update: function(msg) {
                // should we do anything on msg status change?
                Hypno.log(' ** status_update fired');
                chrome.extension.sendRequest({
                                                 action: 'ui_reload_messages',
                                                 data: Hypno.Messages.list
                                             });
                chrome.extension.sendRequest({
                                                 action: 'ui_reload_contacts',
                                                 data: Hypno.Contacts.list
                                             });
                return 1;
            },

            message: function(msg) {
                // TODO FIXME
                return 1;
            },

            contact_list: function(msg) {
                Hypno.Contacts.Load();
                return 1;
            },

            registered: function(msg) {
                Hypno.Actions.Registered();
                return 1;
            },

            not_registered: function(msg) {
                Hypno.Actions.DeviceNotRegistered();
                return 1;
            }
        },

        // binding all params to global ws object
        init: function() {
            Hypno.ws.conn.init();
        }
    }
};

chrome.browserAction.setTitle({title: chrome.i18n.getMessage('name')});