var page = new WebPage(), testindex = 0, loadInProgress = false;
var system = require('system');

var all = system.args[1].split(":::");

var address = decodeURIComponent(all[0]);
var email = decodeURIComponent(all[1]);
var password = decodeURIComponent(all[2]);


page.onConsoleMessage = function(msg) {
  console.log(msg);
};

page.onLoadStarted = function() {
  loadInProgress = true;
  console.log("load started");
};

page.onLoadFinished = function() {
  loadInProgress = false;
  console.log("load finished");
};

var steps = [
  function() {
    //Load Login Page
    page.open(address);
  },
  function() {
    //Enter Credentials
    page.evaluate(function(email, password) {

      document.getElementById('login_email').value = email;
      document.getElementById('login_password').value = password;
    }, email, password);
  }, 
  function() {
    //Login
    page.evaluate(function() {
      var arr = document.getElementsByTagName("form");
      var i;

      for (i=0; i < arr.length; i++) {
          arr[i].submit();
          return;
      }

    });
  }, 
  function() {
    // Output content of page to stdout after form has been submitted
    page.evaluate(function() {
      
      document.querySelector("input[name=allow_access]").click();

    });
  },
  
  function() {
    console.log(document.getElementsByTagName('html')[0].outerHTML)
  }
];


interval = setInterval(function() {
  if (!loadInProgress && typeof steps[testindex] == "function") {
    console.log("step " + (testindex + 1));
    steps[testindex]();
    testindex++;
  }
  if (typeof steps[testindex] != "function") {
    console.log("test complete!");
    phantom.exit();
  }
}, 30);