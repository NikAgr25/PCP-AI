// ============================================================
// PCP AI - AUTHENTICATION
// ============================================================

const API_BASE = "";


// ------------------------------------------------------------
// ELEMENTS
// ------------------------------------------------------------

const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const showRegister = document.getElementById("showRegister");
const showLogin = document.getElementById("showLogin");

const loginButton = document.getElementById("loginButton");
const registerButton = document.getElementById("registerButton");

const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");


// ------------------------------------------------------------
// MESSAGE
// ------------------------------------------------------------

function showMessage(element, message, type = "error") {

    if (!element) return;

    element.textContent = message;

    element.className = "auth-message " + type;

    element.style.display = "block";
}


function hideMessage(element) {

    if (!element) return;

    element.textContent = "";

    element.style.display = "none";
}


// ------------------------------------------------------------
// SWITCH LOGIN / REGISTER
// ------------------------------------------------------------

if (showRegister) {

    showRegister.addEventListener("click", function(event) {

        event.preventDefault();

        hideMessage(loginMessage);

        loginSection.style.display = "none";
        registerSection.style.display = "block";

    });

}


if (showLogin) {

    showLogin.addEventListener("click", function(event) {

        event.preventDefault();

        hideMessage(registerMessage);

        registerSection.style.display = "none";
        loginSection.style.display = "block";

    });

}


// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------

if (loginForm) {

    loginForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        hideMessage(loginMessage);

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        if (!email || !password) {

            showMessage(
                loginMessage,
                "Please enter email and password."
            );

            return;
        }


        loginButton.disabled = true;
        loginButton.textContent = "Signing In...";


        try {

            const response = await fetch(
                API_BASE + "/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );


            let data = {};

            try {

                data = await response.json();

            } catch {

                data = {};

            }


            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    data.message ||
                    "Invalid email or password."
                );

            }


            const token =
                data.access_token ||
                data.token;


            if (!token) {

                throw new Error(
                    "Login succeeded but no authentication token was received."
                );

            }


            localStorage.setItem(
                "token",
                token
            );

            localStorage.setItem(
                "access_token",
                token
            );

            localStorage.setItem(
                "email",
                data.email || email
            );


            showMessage(
                loginMessage,
                "Login successful. Opening dashboard...",
                "success"
            );


            setTimeout(function() {

                window.location.href =
                    "/dashboard";

            }, 500);


        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            showMessage(
                loginMessage,
                error.message ||
                "Unable to connect to the server."
            );

        } finally {

            loginButton.disabled = false;
            loginButton.textContent = "Sign In";

        }

    });

}


// ------------------------------------------------------------
// REGISTER
// ------------------------------------------------------------

if (registerForm) {

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        hideMessage(registerMessage);

        const email =
            document
                .getElementById("registerEmail")
                .value
                .trim();

        const password =
            document
                .getElementById("registerPassword")
                .value;


        if (!email || !password) {

            showMessage(
                registerMessage,
                "Please enter email and password."
            );

            return;
        }


        if (password.length < 6) {

            showMessage(
                registerMessage,
                "Password must contain at least 6 characters."
            );

            return;
        }


        registerButton.disabled = true;
        registerButton.textContent = "Creating Account...";


        try {

            const response = await fetch(
                API_BASE + "/api/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );


            let data = {};

            try {

                data = await response.json();

            } catch {

                data = {};

            }


            if (!response.ok) {

                throw new Error(
                    data.detail ||
                    data.message ||
                    "Unable to create account."
                );

            }


            showMessage(
                registerMessage,
                "Account created successfully. You can now sign in.",
                "success"
            );


            document.getElementById(
                "email"
            ).value = email;


            document.getElementById(
                "password"
            ).value = "";


            setTimeout(function() {

                registerSection.style.display = "none";

                loginSection.style.display = "block";

                hideMessage(registerMessage);

            }, 1000);


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            showMessage(
                registerMessage,
                error.message ||
                "Unable to create account."
            );

        } finally {

            registerButton.disabled = false;
            registerButton.textContent = "Create Account";

        }

    });

}