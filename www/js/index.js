


var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
		$('#disconnectButton').attr('style', 'display:none;');
		$("#searchButton").attr('style', 'display:inline;');
		btc.startUpdating();
    }
    
};


var btc = {
	apiurl: "https://api.coindesk.com/v1/bpi/currentprice.json",
	currentPrice: 0,
	previousPrice: 0,
	lastUpdated: 0,
	calculateDifference: function() {
		if (this.previousPrice == 0 || this.currentPrice == 0) return 0;
		return this.currentPrice - this.previousPrice;
	},
	calculatePercentage: function() {
		if (this.previousPrice == 0) return 0;
		var divided = this.calculateDifference() / this.previousPrice;
		return divided * 100;
	},
	
	getCurrentPrice: function () {
		var xhttp = new XMLHttpRequest();
		xhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				var response = JSON.parse(this.responseText);
				var price = response['bpi']['USD']['rate_float'];
				btc.lastUpdated = new Date(response['time']['updatedISO']);
				if (price == btc.currentPrice) return; //only update if price changed
				btc.previousPrice = btc.currentPrice;
				btc.currentPrice = price;
				updateView();
				wearable.updateBluetooth();
			}
		};
		xhttp.open("GET", this.apiurl, true);
		xhttp.send();
	},
	
	startUpdating: function() {
		this.interval = setInterval(function(){btc.getCurrentPrice();}, 60000);
		this.getCurrentPrice();
	},
	
	stopUpdating: function() {
		clearInterval(this.interval);
	}
};

function updateView() {
	var price = document.getElementById("currentPrice");
	var change = document.getElementById("currentChange");
	var update = document.getElementById("lastTimeUpdated");
	price.innerHTML = "Current btc Rate:</br>" + btc.currentPrice.toFixed(2) + " USD";
	change.innerHTML  =	"Change last minute:</br>" + btc.calculateDifference().toFixed(2) + " USD/" + btc.calculatePercentage().toFixed(2) + "%";
	update.innerHTML = "Last Updated:</br>" + btc.lastUpdated.toLocaleTimeString();
	if (btc.calculateDifference() < 0) {
		change.style.color = "#f44336";
	} else {
		change.style.color = "#4caf50";
	}

	
}

var wearable = {
	name: "TECO WEARABLE", //TECO WEARABLE
	VIB_SERVICE: "713D0000-503E-4C75-BA94-3148F18D941E",
	VIB_CHARACTERISTIC: "713D0003-503E-4C75-BA94-3148F18D941E",
	currentDevice: null,
	currentDeviceId: null,
	
	disconnect: function() {
		ble.disconnect(wearable.currentDevice.id);
		wearable.currentDevice = null;
		wearable.currentDeviceId = null;
		$('#disconnectButton').attr('style', 'display:none;');
		$("#searchButton").attr('style', 'display:inline;');
		$("#status").html("Not Connected");
		$("#status")[0].style.backgroundColor = "#f44336";
	},
	scan: function() {
		$("#status").html("Scanning...");
		$("#searchButton").prop("disabled");
		$("#status")[0].style.backgroundColor = "#4B946A";
		ble.scan([], 10, function(device) {
			
			// If a device was found, check if the name includes "TECO WEARABLE"
			if (device.name.toUpperCase().includes(wearable.name)) {
				$("#status").html("Connecting to Wearable...");
				
				// If so, stop scan immediately and connect.
				ble.stopScan(wearable.stopSuccess, wearable.stopFailure);
				clearTimeout(scanTimeout);
				ble.connect(device.id, wearable.connectSuccess, wearable.connectFailure);
				connected = true;
			}
		}, function() {
			$("#status").html("Scan failed.");
			$("#status")[0].style.backgroundColor = "#f44336";
		});
		
		scanTimeout = setTimeout(function() {
			$("#status").html("Device not Found after 10s");
		}, 10000);
	},
	stopSuccess: function(){console.log("stopSuccess")},
	stopFailure: function(){console.log("stopFailure")},
	connectSuccess: function(device) {
		console.log(JSON.stringify(device));
		$("#status").html("Connected");
		$('#searchButton').attr('style', 'display:none;');
		$("#searchButton").removeProp("disabled");
		$("#disconnectButton").attr('style', 'display:inline;');
		wearable.currentDevice = device;
		wearable.currentDeviceId = device.id;
		$("#status")[0].style.backgroundColor = "#4B946A";
		
		//turnoffmotors
		console.log("connected, so lets turn off motors")
		ble.writeWithoutResponse(
		wearable.currentDevice.id,
		wearable.VIB_SERVICE,
		wearable.VIB_CHARACTERISTIC,
		(new Uint8Array(4)).buffer),
		function(){console.log("turned off motors")},
		function(){console.log("couldnt turn off")};
	
	},
	connectFailure: function(device) {
		console.log("ERROR!!!!!!!!!!!!! " + JSON.stringify(device));
		$("#status").html("Disconnected.. Retrying");
		$("#status")[0].style.backgroundColor = "#f44336";
		ble.connect(device.id, wearable.connectSuccess, wearable.connectFailure);		
	},
	updateBluetooth: function() {
		if (wearable.currentDevice == null) {
			return;
		}
		var data = new Uint8Array(4);
		var rising = btc.currentPrice > btc.previousPrice;
		
		if(rising) {
			data[0] = 0x00;
			data[1] = 0x00;
			data[2] = 0xff;
			data[3] = 0xff;
			console.log("Setting right Motors");
		} else {
			data[0] = 0xff;
			data[1] = 0xff;
			data[2] = 0x00;
			data[3] = 0x00;
			console.log("Setting left Motors");
		}
		var rumbleTime = map_range(Math.abs(btc.calculatePercentage()), 0.0, 1.0, 50, 10000);
		console.log("for " + rumbleTime + " ms");
		
		ble.writeWithoutResponse(
			wearable.currentDevice.id,
			wearable.VIB_SERVICE,
			wearable.VIB_CHARACTERISTIC,
			data.buffer,
			function(){console.log("wrote " + JSON.stringify(data))},
			function(){console.log("couldnt write " + JSON.stringify(data))}
		);
		
		setTimeout(function() {
			console.log("stop rumbling");
				ble.writeWithoutResponse(
				wearable.currentDevice.id,
				wearable.VIB_SERVICE,
				wearable.VIB_CHARACTERISTIC,
				(new Uint8Array(4)).buffer),
				function(){console.log("turned off motors")},
				function(){console.log("couldnt turn off")};
		}, rumbleTime);

	}

	
}
function map_range(val, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (val - low1) / (high1 - low1);
}
