// wrapper :)
var chrome = {
    extension: {
        onRequest: {
            addListener: function() {
                HypnoToad.warn('Add listener found');
            }
        },
        sendRequest: function() {
            HypnoToad.warn('send request called');
        },

        getURL: function() {
            opera.postError('getURL called');
        }
    },

    browserAction: {
        setPopup: function() {
            opera.postError('setPopup called');
        },

        setIcon: function() {
            opera.postError('setIcon called');
        },
        setBadgeText: function() {
            opera.postError('setBadgeText called');

        },
        setTitle: function() {
            opera.postError('setTitle');
        }

    },

    tabs: {
        create: function(params) {
            opera.postError('creating tabs');
            opera.extension.tabs.create({
                                            focused: true,
                                            url: params.url
                                        });

        },
        onClicked: {
            listeners: []
        }

    },

    i18n: {
        data: {},
        getMessage: function(string) {
            return chrome.i18n.data[string];
        }
    }
};
