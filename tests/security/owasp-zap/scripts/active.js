// Custom ZAP Active Scan Script for REST API Security Testing
// This script tests for API-specific vulnerabilities

var PluginPassive = Java.type("org.zaproxy.zap.extension.script.PluginPassive");
var HttpSender = Java.type("org.parosproxy.paros.network.HttpSender");
var HttpRequestHeader = Java.type("org.parosproxy.paros.network.HttpRequestHeader");
var URI = Java.type("org.apache.commons.httpclient.URI");
var Alert = Java.type("org.parosproxy.paros.core.scanner.Alert");
var Model = Java.type("org.parosproxy.paros.model.Model");

function scan(helper, msg, param, value) {
    // Test 1: Check for mass assignment on POST/PUT endpoints
    if (msg.getRequestHeader().getMethod() === "POST" ||
        msg.getRequestHeader().getMethod() === "PUT") {

        var body = new String(msg.getRequestBody().getBytes());
        var path = msg.getRequestHeader().getURI().getPath();

        // Test for admin role escalation via mass assignment
        if (body.indexOf("is_admin") === -1 && body.indexOf("role") === -1) {
            var testBody = body;
            if (testBody.charAt(testBody.length - 1) === "}") {
                testBody = testBody.substring(0, testBody.length - 1) + ', "is_admin": true}';
            }

            var newMsg = msg.cloneRequest();
            newMsg.getRequestBody().setBytes(testBody.getBytes());
            newMsg.getRequestHeader().setContentLength(newMsg.getRequestBody().length());

            try {
                var response = helper.sendAndReceive(newMsg);
                if (response.getResponseHeader().getStatusCode() === 200) {
                    helper.raiseAlert(
                        helper.newAlert()
                            .setRisk(Alert.RISK_HIGH)
                            .setConfidence(Alert.CONFIDENCE_MEDIUM)
                            .setName("Mass Assignment - Role Escalation")
                            .setDescription("The endpoint accepts unexpected fields like 'is_admin' in the request body, allowing privilege escalation via mass assignment.")
                            .setSolution("Use DTOs (Data Transfer Objects) to whitelist allowed fields. Implement input validation.")
                            .setReference("https://owasp.org/www-community/attacks/Mass_Assignment_Attack")
                            .setParam(param)
                            .setAttack("is_admin: true")
                            .setEvidence(new String(response.getResponseBody().getBytes()))
                    );
                }
            } catch (e) {
                // Ignore errors
            }
        }
    }

    // Test 2: Check for auth token exposure in URL
    var url = msg.getRequestHeader().getURI().toString();
    if (url.indexOf("token") !== -1 || url.indexOf("jwt") !== -1 || url.indexOf("bearer") !== -1) {
        helper.raiseAlert(
            helper.newAlert()
                .setRisk(Alert.RISK_HIGH)
                .setConfidence(Alert.CONFIDENCE_HIGH)
                .setName("Authentication Token Exposure in URL")
                .setDescription("Authentication tokens should never be transmitted in URL parameters as they may be logged or exposed.")
                .setSolution("Transmit tokens via HTTP headers (Authorization: Bearer <token>).")
                .setReference("https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url")
                .setEvidence(url)
        );
    }

    // Test 3: Check for missing security headers
    var responseHeaders = msg.getResponseHeader();
    var securityHeaders = [
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-XSS-Protection"
    ];

    var missingHeaders = [];
    for (var i = 0; i < securityHeaders.length; i++) {
        if (responseHeaders.getHeader(securityHeaders[i]) === null) {
            missingHeaders.push(securityHeaders[i]);
        }
    }

    if (missingHeaders.length > 0) {
        helper.raiseAlert(
            helper.newAlert()
                .setRisk(Alert.RISK_MEDIUM)
                .setConfidence(Alert.CONFIDENCE_MEDIUM)
                .setName("Missing Security Headers")
                .setDescription("The following security headers are missing: " + missingHeaders.join(", "))
                .setSolution("Add the missing security headers to all responses.")
                .setReference("https://owasp.org/www-project-secure-headers/")
                .setEvidence(missingHeaders.join(", "))
        );
    }

    // Test 4: Check for CORS misconfiguration
    var allowOrigin = responseHeaders.getHeader("Access-Control-Allow-Origin");
    if (allowOrigin !== null && (allowOrigin === "*" || allowOrigin === "null")) {
        helper.raiseAlert(
            helper.newAlert()
                .setRisk(Alert.RISK_MEDIUM)
                .setConfidence(Alert.CONFIDENCE_HIGH)
                .setName("CORS Misconfiguration")
                .setDescription("Access-Control-Allow-Origin is set to '" + allowOrigin + "', which allows any origin to access the API.")
                .setSolution("Restrict CORS to specific trusted origins. Do not use wildcard or 'null' for credentialed requests.")
                .setReference("https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny")
                .setEvidence("Access-Control-Allow-Origin: " + allowOrigin)
        );
    }

    // Test 5: Check for sensitive data in response
    var responseBody = new String(msg.getResponseBody().getBytes());
    var sensitivePatterns = [
        /"password"\s*:/i,
        /"credit_card"\s*:/i,
        /"ssn"\s*:/i,
        /"secret"\s*:/i,
        /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
        /"api_key"\s*:/i
    ];

    for (var j = 0; j < sensitivePatterns.length; j++) {
        if (sensitivePatterns[j].test(responseBody)) {
            helper.raiseAlert(
                helper.newAlert()
                    .setRisk(Alert.RISK_HIGH)
                    .setConfidence(Alert.CONFIDENCE_MEDIUM)
                    .setName("Sensitive Data Exposure in Response")
                    .setDescription("Sensitive data pattern detected in API response body.")
                    .setSolution("Never include sensitive data (passwords, keys, PII) in API responses. Use field-level filtering.")
                    .setReference("https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure")
                    .setEvidence(responseBody.substring(0, 200))
            );
            break;
        }
    }

    // Test 6: Check for debug endpoints
    var debugPaths = ["/debug", "/api/debug", "/api/docs", "/graphql", "/actuator", "/swagger"];
    var currentPath = msg.getRequestHeader().getURI().getPath();
    for (var k = 0; k < debugPaths.length; k++) {
        if (currentPath.indexOf(debugPaths[k]) !== -1) {
            helper.raiseAlert(
                helper.newAlert()
                    .setRisk(Alert.RISK_MEDIUM)
                    .setConfidence(Alert.CONFIDENCE_MEDIUM)
                    .setName("Debug/Info Endpoint Exposed")
                    .setDescription("Debug or informational endpoint exposed: " + currentPath)
                    .setSolution("Disable debug endpoints in production. Use proper authentication for API documentation.")
                    .setEvidence(currentPath)
            );
            break;
        }
    }

    // Test 7: Check for IDOR (Insecure Direct Object Reference) patterns
    if (path.match(/\/api\/(users|memberships|subscriptions|compliance)\/\d+/)) {
        // Attempt to access with a different ID
        var originalId = path.match(/\d+/)[0];
        var newId = String(parseInt(originalId) + 1);

        var idorMsg = msg.cloneRequest();
        var idorUri = new URI(path.replace(originalId, newId), true);
        idorMsg.getRequestHeader().setURI(idorUri);

        try {
            var idorResponse = helper.sendAndReceive(idorMsg);
            if (idorResponse.getResponseHeader().getStatusCode() === 200) {
                helper.raiseAlert(
                    helper.newAlert()
                        .setRisk(Alert.RISK_HIGH)
                        .setConfidence(Alert.CONFIDENCE_LOW)
                        .setName("Potential Insecure Direct Object Reference (IDOR)")
                        .setDescription("The endpoint may allow accessing resources belonging to other users by modifying the ID in the URL.")
                        .setSolution("Implement proper authorization checks for all resource access. Use UUIDs instead of sequential IDs.")
                        .setReference("https://owasp.org/www-community/attacks/IDOR")
                        .setAttack("ID: " + originalId + " -> " + newId)
                        .setEvidence("URL: " + idorUri.toString())
                );
            }
        } catch (e) {
            // Ignore errors
        }
    }
}

function getPluginId() {
    return 50001;
}

function getPluginName() {
    return "API-Specific Security Tests";
}

function getDescription() {
    return "Custom active scan script for REST API security testing";
}

function getSolution() {
    return "Review each finding individually";
}

function getRisk() {
    return Alert.RISK_HIGH;
}

function getConfidence() {
    return Alert.CONFIDENCE_MEDIUM;
}
