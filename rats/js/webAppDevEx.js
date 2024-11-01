var _histTable;
var _map;
var _lang;
var _iframeObserver;

// ***************************************
// * EVENT HANDLERS
// **************************************

function onMapLoad(_map) {
	setTranslateText(_map);
	// add listener for when layers load
	navigator.geolocation.getCurrentPosition(function(position){
		var iframe = getIframe();
		var point = new iframe.contentWindow.esri.geometry.Point({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        });
		console.log("center and zoom: " + position.coords.latitude + "," +  position.coords.longitude);
		if (40.495992 < point.latitude && point.latitude < 40.915568 && -74.257159 < point.longitude && point.longitude< -73.699215) {
			_map.centerAndZoom(point, 15);
		}
	});
}

function onTabChange(event, ui) {
	var newTab = ui.newTab[0].children[0].getAttribute('ui-sref');
	if (newTab != 'propertyhistory') $("#tabs").tabs("disable",1);
	layoutWindow(newTab);
}

function onesriPopupChange(_div) {
	editPopup(_div);
}

function onesriMobileInfoViewChange(_div) {
	editPopup(_div);
}

// *****************************
// actio-node div contains the side panel
// *****************************
function onactionnodeLoad(_div) {
	if (window.innerWidth <= 1024) _div.click();	
}

function onWindowResize() {
	var activeTab = $("#tabs .ui-tabs-active")[0].innerText;
	layoutWindow(activeTab);
	// reset _histTable so it will force resize
	_histTable = null;
}

function onIframeLoaded(iframe) {
	// disable property history tab 
	$("#tabs").tabs("disable",1);
	var activeTab = $("#tabs .ui-tabs-active")[0].children[0].getAttribute('ui-sref');
	layoutWindow(activeTab);
} 


// ************************************************
// * HELPER FUNCTIONS
// ************************************************

// function gets the text from the popup window and stores it into
// a double piped (||) delimited list in two hidden divs 
// when google translate works on the page it will translate the second div 
// but not the first (which has a class of notranslate)
// These will be used later to tranlate the popups
// The html for the popup with substitions is stored on the feature layers
// infoTemplate attribute. This needs to wait until the map is loaded and all
// feature layers are loaded. Specifically it is looking for layers with names that startsWith
// with PCS_DOHMHRatMap_Inspection
function setTranslateText(_map)
{
	// function goes through an element and iteratively goes
	// through child elements extracting all textContent values
	// it strips any values between {} which are substititution values
	// in infotTemplate
	function getChildTextContent(_node, _vals) {
		if (!_node.hasChildNodes()) {
			var txt = _node.textContent.trim().split('{');
			txt.forEach(function(t) {
				var v = t.substr(t.search('}')+1).trim();
				if (v.length > 0) _vals.push(v); 
			});
			return true;
		}
		_node.childNodes.forEach(function(child) {
			getChildTextContent(child, _vals);
		});
	}
	
	function createDiv(_parent, _node, _key, _class) {
		var _div = document.createElement('div');
		_div.setAttribute('id', _parent.attr('id') + '-' + _key);
		if (_class) _div.setAttribute('class', _class);
		_div.setAttribute('key',_key);
		_div.innerHTML = _node;
		_parent.append(_div);
		return _div;
	}
	
	// get inspection layers
	var lyrs = [];
	var textNodes = [];
	for (var k in _map._layers) {lyrs.push(_map._layers[k])};
	// for each layer get the info template. convert it to xml and then get add all innertext not enclosed by{}
	// to _lines array
	lyrs.forEach(function(l) {
		if (l.infoTemplate && l.infoTemplate.info) {
			// this is the html for the infoTemplate
			var _descr = l.infoTemplate.info.description;
			// xml conversion does not like url for some reason
			// urls are in single quotes. this removes all urls from the info
			// template html so it can be read as xml document
			if (_descr) {
				var _lines  = _descr.split("'");
				for (var i=0; i<_lines.length; i++) {
					if (_lines[i].startsWith('http')) _lines[i]='';
				}
				// parse the above html into xml and add innertext to textNodes
				var s = '<doc>' + _lines.join("'") + '</doc>';
				var _xml = jQuery.parseXML(s);
				getChildTextContent(_xml, textNodes);	
			}
		}
	})	
	// add each the phrases to translate as divs with key for the index
	// two divs are added one for the original phrase and one that will be translated
	var originalDiv = $("#popup-original");
	var translatedDiv = $("#popup-translated");
	for (var i=0; i<textNodes.length;i++) {
		// add divs to both of the above
		createDiv(originalDiv, textNodes[i], i);
		createDiv(translatedDiv, textNodes[i], i, 'translate-hide');
	}
}


// *************************
// function edits the popup to replace the code underlying the property history 
// link. It expects that this link will be the first <a> in the popup
// *************************
function editPopup(_div) {
	function loadTranslatePhrases(_parent) {
		var _phrases = {};
		var maxKey = -1;
		_parent.childNodes.forEach(function(_node) {
			var key = parseInt(_node.attributes['key'].value);
			if (!(key in _phrases) || (key in _phrases && _node.childElementCount)) 
				_phrases[key] = _node.innerText;
			maxKey = Math.max(maxKey, key);
		});
		// convert dictionary to array
		var _ret = Array(maxKey);
		for (var key in _phrases) {
			_ret[key] = _phrases[key];
		}
		return _ret;
	}

	// check to see if language has changed. If so hide toolbar at the top
	if (_lang != getLanguage()) {
		var _tbs = document.getElementsByClassName('goog-te-banner-frame');
		if (_tbs.length) {
			var _tb = _tbs[0];
			_tb.style.visibility = "hidden";
			_tb.style.display="none";
			var _body = document.getElementsByTagName("BODY")[0]; 
			_body.style.top = 0; 
		}
		_lang = getLanguage();
	}

	if (_div) {
		var mainSection = _div.getElementsByClassName("mainSection")[0];
		if (mainSection) {
			// first get the bbl - do this before translate
			var bbl = null;
			var address = null;
			if (_map && _map.infoWindow && _map.infoWindow.features.length > 0) {
				var _feat = _map.infoWindow.features[0].attributes;
				address = _feat.Address;
				bbl = _feat.BBL;
			}
			
			// change link to Property history to call viewPropertyHistory()
			var _aHistory = _div.getElementsByTagName("a")[1];
			if (_aHistory && _aHistory.innerText.toLocaleLowerCase().includes('history')) {
				// Temporary fix 
				mainSection.innerHTML = mainSection.innerHTML.replace('Failed for Other R</b>', 'Failed for Other Reason</b>')
				// translate the text in the popup
				var doNotTranslate = ['BBL'];
				var original = loadTranslatePhrases($('#popup-original')[0]);
				var translated = loadTranslatePhrases($('#popup-translated')[0]);
				if (translated.length == original.length) {
					var translatedTxt = mainSection.innerHTML;
					var changed = false;
					for (var i=0; i<translated.length; i++) {
						if (translated[i] != original[i] && translated[i].trim().length && !(doNotTranslate.indexOf(original[i].trim()) > -1)) {
							translatedTxt = translatedTxt.replace(original[i], translated[i].trim());
							changed = true;
						}
					}
					if (changed) mainSection.innerHTML = translatedTxt;
				}
				
				// need to reget a because it may have been replaced
				var _aHistory = _div.getElementsByTagName("a")[1];
				// check to see if it has an id set. If not it is newly createDiv
				if (!('id' in _aHistory.attributes)) {
					// set the id
					_aHistory.setAttribute('id','propHistoryLink');
				} 
				// get the element and find out if it has any events attached to it
				var _ev = $._data(_aHistory, 'events');
				_aHistory = $(_aHistory);
				if (!_ev) {
					_aHistory.removeAttr('target');
					_aHistory.attr('href','#');
					_aHistory.click(function(evt) {
						if (bbl) viewPropertyHistory(bbl, address);
						return false;
					});
				}
				// create links for view faq link
				var _aFAQ = _div.getElementsByTagName("a")[0];
				_aFAQ.setAttribute('href', '#');
				_aFAQ.removeAttribute('target');
				_aFAQ.onclick=function(e) {
					$("#tabs").tabs({active:3});
				}
			}
		}
	}
}


// *************************
// called to resize the window for everything except the map tab
// if the window content is bigger than the window size it places the footer at the bottom of the content
// and the user will have to scroll down to see the footer. If the content is smaller than the window size
// it anchors the footer at the bottom of the window
// *************************
function layoutWindow(activeTab) {
	var remainingSpace = window.innerHeight - document.getElementById("tabsUL").offsetHeight - document.getElementById("top").offsetHeight;
	var tabs = document.getElementById('tabs');
	var footerHeight = window.innerWidth < 768 ? 0 : document.getElementById("NYCfooterOuter").offsetHeight;
	var innerWrap = document.getElementById("inner-wrap");
	if (activeTab == 'map') {
		// map should always fill up remaining space unless remaining space is less than 500px
		var iframe = getIframe();
		var mapHeight = (remainingSpace <= 500)?500:remainingSpace; 
		innerWrap.style.marginBottom="0";
		iframe.height= mapHeight;
	} else  {
		if (tabs.offsetHeight > (remainingSpace - footerHeight)) {
			innerWrap.style.marginBottom = "0";
		} else {
			innerWrap.style.marginBottom = String(-1 * footerHeight) + 'px';
		}
	}
}

function resizeMap() {
	var iframe = document.getElementById("webappbld").getElementsByTagName("iframe")[0];
	// var footerHeight = document.getElementById("NYCfooterOuter").offsetHeight;
	// var footer = getComputedStyle(div).marginBottom
	// if the height of iframe is less than min-height then set bottom margin of inner-wrap to 0 and do not remove from iframe height
	// var targetHeight = window.innerHeight - document.getElementById("tabsUL").offsetHeight - document.getElementById("top").offsetHeight - footerHeight;
	var innerWrap = document.getElementById("inner-wrap");
	var remainingSpace = window.innerHeight - document.getElementById("tabsUL").offsetHeight - document.getElementById("top").offsetHeight;
	if (remainingSpace <= 500) {
		innerWrap.style.marginBottom="0px";
		innerWrap.style.minHeight="0px";
		iframe.height=500;
	} else {
		var footerHeight = window.innerWidth < 768 ? 0 : document.getElementById("NYCfooterOuter").offsetHeight;
		innerWrap.style.minHeight="100%"
		innerWrap.style.marginBottom= String(-1 * footerHeight) + "px";
		iframe.height = remainingSpace - footerHeight;
	}
	// code to close side panel
	// iframe.contentDocument.getElementsByClassName('action-node')[0].click()
	// call on iphone
}

function viewFAQ() {
	$("#tabs").tabs({active:3});
	document.getElementById('header-logo').scrollIntoView();
}

function viewPropertyHistory(bbl, address) {
	$("#tabs").tabs("enable",1);
	$("#tabs").tabs({active:1});

	// set bbl 
	$("#property-history-bbl")[0].innerText = bbl;
	$("#property-history-address")[0].innerText = address;
	
	// build the history table if it doesn't exist	
	if (!_histTable) {
		_histTable = new Tabulator("#property-history", {
			layout:"fitColumns", //fit columns to width of table (optional)
			columns:[ //Define Table Columns
				{title:"Date", field:"inspection_date", 
					formatter:function(cell,params) {
						d = new Date(cell.getValue());
						m = (d.getMonth() + 1);
						monthVal = (m < 10 ? '0' : '') + m;
						dy = d.getDate();
						dayVal = (dy < 10 ? '0' : '') + dy;
						return (monthVal + "/" + dayVal + "/" + d.getFullYear())},
					sorter: function(a,b,aRow,bRow, column, dir, sorterParams) {
						return (new Date(a)) - (new Date(b));
					}},
				{title:"Inspection Type", field:"inspection_type"},
				{title:"Result", field:"result", align:"left",
					formatter: function(cell, params) {
						if (cell.getValue() == 'Failed for Other R') {
							return "Failed for Other Reasons";
						} 
						return cell.getValue();
					}
				},
			],
			initialSort:[{column:"inspection_date", dir: "desc"},],
		});	
	}
	
	// make request to open data
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState==4 && this.status==200) {
			_histTable.setData(xhttp.responseText, {bbl:bbl}, 'GET');
			_histTable.setSort('inspection_date','desc');
			layoutWindow();
		}
	}
	xhttp.open('GET', 'https://data.cityofnewyork.us/resource/a2h9-9z38.json?bbl=' + bbl, true)
	xhttp.send();
}


//******************************
//CODE TO TRIGGER EVENT FUNCTIONS ABOVE
//******************************

function getIframe()
{
	return document.getElementById("webappbld").getElementsByTagName("iframe")[0];
}

//gets the cookie named
function readCookie(name) {
	var c = document.cookie.split('; '),
	cookies = {}, i, C;

	for (i = c.length - 1; i >= 0; i--) {
		C = c[i].split('=');
		cookies[C[0]] = C[1];
	 }

	 return cookies[name];
}	

// get the current google translate language
function getLanguage() {
	return readCookie('googtrans');
}

// **********************
// Function returns a function object from a string. If the function is not defined it 
// returns null
// **********************
function getFunction(funcName) {
	try {
		return eval(funcName);
	} 
	catch(err) {
		return null;
	}
}

// *********************
// Function is called by onload event of iframe. It adds a mutation observer to listen for when
// the classes specified in _divClasses exist. When it finds an element with this class it checks
// to see if the classes onLoad method is defined. The onLoad method should be the same as the
// "on" + [div class name] + "Load". It also checks to see if an onChange event exists. If so
// it adds a mutation observer to listen to when the onChange event occurs. Finally, this method listens
// for when the map itself exists. When it does it calls onMapLoad() (if defined) and sets the _map 
// variable. Once all _div elements are found this stops listening to changes in iframe.
// These listeners need to be triggered this way because the map and associated elements are loaded 
// dynamically so they are not available in the document.onload event or the iframe.onload event. 
// the iframe itself must be on the same domain as the web page.
// *********************
function onIframeLoad() {
	var _divClasses = ["action-node", "esriPopup", "esriMobileInfoView"];
	var iframe = getIframe();
	// var doc = iframe.contentDocument || iframe.contentWindow.document
	var doc = iframe.contentDocument;
	window.onresize = onWindowResize;
	// get the language from the cookie
	_lang = getLanguage();
	if (doc ) {
		if (!_iframeObserver) {
			onIframeLoaded();
			var observerConfig = { attributes: false, childList: true, characterData: false, subtree: true };	
			var divs = {};
			_iframeObserver = new MutationObserver(
				function(mutation) {
					// check for map if found store as global variable and trigger onMapLoad (if defined)
					if (!_map) {
						_map = iframe.contentWindow ? iframe.contentWindow._viewerMap : null;
						if (_map && getFunction("onMapLoad")) onMapLoad(_map);
					}
					var _found = [];
					for (j=0;j<_divClasses.length;j++) {
						if (doc) {
							var _div = doc.getElementsByClassName(_divClasses[j])[0];
							if (_div) {
								// add to found so it can be removed from classes to listen for load
								_found.push(_divClasses[j]);
								// add on load if handler exists
								var _divClass = _divClasses[j];
								// if the onload function exists invoke it with _div as argument
								var onLoadFunction = getFunction("on" + _divClass.replace('-','') + "Load");
								if (onLoadFunction) onLoadFunction(_div);
								// check for onChange function
								var onChangeFunction = getFunction("on" + _divClass.replace('-','') + "Change");
								if (onChangeFunction) {
									var observerConfig = {attributes: true, childList: true, characterData: true, subtree: true };	
									// create observer for changes to div
									var onChangeObserver = new MutationObserver(function() {
										// disconnect so if modify div in onChange function does not send into endless loop
										this.disconnect();
										onChangeFunction(this._div);
										this.observe(this._div, observerConfig);
									});
									onChangeObserver._div = _div;
									onChangeObserver.observe(_div, observerConfig);
								}
							}
						}
					}
					// remove from divClasses
					_divClasses = _divClasses.filter(function(x) {return _found.indexOf(x) == -1});
					if (_divClasses.length == 0) {
						this.disconnect();
					}
				}
			)
			_iframeObserver.observe(iframe.contentDocument.getElementById("jimu-layout-manager"), observerConfig);	
		}
	}
}

// *************************
// Add startsWith for ie
// *************************
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

// *************************
// Add foreach to NodeList for ie
// *************************
if (!NodeList.prototype.forEach) {
    NodeList.prototype.forEach = function(fn, scope) {
        for(var i = 0, len = this.length; i < len; ++i) {
            fn.call(scope, this[i], i, this);
        }
    }
}