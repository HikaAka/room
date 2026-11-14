// EMQX Cloud: ブラウザに認証情報をハードコードしない
const EMQX_WSS_URL = "wss://i13aaaec.ala.asia-southeast1.emqxsl.com:8084/mqtt";
let client = null;

function setMqttStatus(message, connected = false) {
    const el = document.getElementById("mqttStatus");
    el.textContent = message;
    el.className = connected ? "statusOn" : "statusOff";
}

// 標準のフォーム送信で、ブラウザのパスワード保存・自動入力を認識しやすくする。
// HTMLに認証情報を埋め込んだり、localStorageへ保存したりはしない。
const mqttLoginForm = document.getElementById("mqttLoginForm");
mqttLoginForm.addEventListener("submit", event => {
    event.preventDefault();  // GitHub Pagesに認証情報を送信しない
    connectToEmqx();
});
document.getElementById("mqttConnectBtn").disabled = false;

function connectToEmqx() {
    const username = document.getElementById("mqttUsername").value.trim();
    const password = document.getElementById("mqttPassword").value;
    if (!username || !password) {
        setMqttStatus("● ユーザー名とパスワードが必要です");
        return;
    }
    if (client) client.end(true);
    setMqttStatus("● Connecting...");
    client = mqtt.connect(EMQX_WSS_URL, {
        clientId: "room-web-" + crypto.randomUUID(),
        username,
        password,
        connectTimeout: 10000,
        reconnectPeriod: 3000,
        clean: true
    });
    // 接続成功まではフォームを維持する。直ちにパスワード欄を消すと
    // ブラウザによってはパスワード保存を認識できないことがある。
    client.on("error", err => {
        console.error("MQTT connection error", err.message);
        setMqttStatus("● MQTT Error: " + err.message);
    });
    client.on("close", () => setMqttStatus("● Disconnected"));

client.on(
    "connect",
    () =>
    {
        setMqttStatus("● Connected", true);
        // ログインが成功したらフォームを隠すことで、
        // 非同期ログインの成功をパスワードマネージャーが検出しやすくする。
        // 保存確認の表示はブラウザに依存する。
        document.getElementById("mqttLoginCard").hidden = true;

        client.subscribe(
            "room/#"
        );
    }
);

client.on(
    "message",
    (topic, payload) =>
    {
        const msg =
            payload.toString();

        console.log(
            topic,
            msg
        );

        updateMqttLastUpdate(
            topic
        );

        let data;
        try {
            data = JSON.parse(msg);
        } catch (e) {
            console.warn("Non-JSON MQTT message", topic);
            return;
        }

        //----------------------------------
        // Sensor
        //----------------------------------

        if(
            topic ===
            "room/sensor/state"
        )
        {
            document
                .getElementById(
                    "tempValue"
                )
                .innerText =
                data.temperature;

            document
                .getElementById(
                    "humidityValue"
                )
                .innerText =
                data.humidity;

            document
                .getElementById(
                    "co2Value"
                )
                .innerText =
                data.co2;

            document
                .getElementById(
                    "pressureValue"
                )
                .innerText =
                data.pressure;
            document
                .getElementById(
                    "absoluteHumidityValue"
                )
                .innerText =
                data.absolute_humidity;
        
            document
                .getElementById(
                    "dewPointValue"
                )
                .innerText =
                data.dew_point;
        }

        //----------------------------------
        // Light
        //----------------------------------

        if(
            topic ===
            "room/light/state"
        )
        {
            document
                .getElementById(
                    "lightPower"
                )
                .innerText =
                data.power ?
                "ON" :
                "OFF";

            document
                .getElementById(
                    "lightBrightness"
                )
                .innerText =
                data.brightness;

            document
                .getElementById(
                    "lightTimer"
                )
                .innerText =
                data.timer;
        }

        //----------------------------------
        // Aircon
        //----------------------------------

        if(
            topic ===
            "room/aircon/state"
        )
        {
            airconSetting =
            {
                power: data.power,
                mode: data.mode,
                temperature: data.temperature,
                fan: data.fan,
                swing_v: data.swing_v,
                swing_h: data.swing_h,
                warp: data.warp,
                bio: data.bio
            };
        
            updateAirconView();
        }
    }
);

}

function publishMqtt(topic, value) {
    if (!client || !client.connected) {
        alert("先にEMQXへ接続してください");
        return;
    }
    client.publish(topic, value);
}

function lightAllOn()
{
    publishMqtt(
        "room/light/all_on",
        "1"
    );
}

function lightOff()
{
    publishMqtt(
        "room/light/all_off",
        "1"
    );
}

function lightNight()
{
    publishMqtt(
        "room/light/night",
        "1"
    );
}

function lightDim()
{
    publishMqtt(
        "room/light/dim",
        "1"
    );
}

function lightTimer()
{
    publishMqtt(
        "room/light/timer",
        "1"
    );
}
let airconSetting =
{
    power: false,
    mode: "OFF",
    temperature: 26,
    fan: "AUTO",
    swing_v: "AUTO",
    swing_h: "AUTO",
    warp: "OFF",
    bio: "OFF"
};
function updateMqttLastUpdate(topic)
{
    const now =
        new Date();

    const timeText =
        now.toLocaleString(
            "ja-JP",
            {
                hour12: false
            }
        );

    document
        .getElementById(
            "mqttLastUpdate"
        )
        .innerText =
        timeText;

    document
        .getElementById(
            "mqttLastTopic"
        )
        .innerText =
        topic;
}

function updateAirconView()
{
    document.getElementById("airconMode").innerText =
        airconSetting.mode;

    document.getElementById("airconTemp").innerText =
        airconSetting.temperature;

    document.getElementById("airconFan").innerText =
        airconSetting.fan;

    document.getElementById("airconSwingV").innerText =
        airconSetting.swing_v;

    document.getElementById("airconSwingH").innerText =
        airconSetting.swing_h;

    document.getElementById("airconWarp").innerText =
        airconSetting.warp;

    document.getElementById("airconBio").innerText =
        airconSetting.bio;

    updateSelectedButtons();
}
function updateSelectedButtons()
{
    document
        .querySelectorAll(".optionBtn, .modeBtn")
        .forEach(button => {
            button.classList.remove("selected");
        });
    
    console.log(airconSetting.mode);
    
    setSelected("mode", airconSetting.mode);
    setSelected("fan", airconSetting.fan);
    setSelected("swing_v", airconSetting.swing_v);
    setSelected("swing_h", airconSetting.swing_h);

    if(airconSetting.warp === "ON")
    {
        setSelected("warp", "ON");
    }

    if(airconSetting.bio === "ON")
    {
        setSelected("bio", "ON");
    }
}

function setSelected(group, value)
{
    const button =
        document.querySelector(
            `[data-group="${group}"][data-value="${value}"]`
        );

    if(button)
    {
        button.classList.add("selected");
    }
}
function tempUp()
{
    if(airconSetting.temperature < 30)
    {
        airconSetting.temperature++;
    }

    updateAirconView();
}

function tempDown()
{
    if(airconSetting.temperature > 18)
    {
        airconSetting.temperature--;
    }

    updateAirconView();
}

function setAirconMode(mode)
{
    airconSetting.mode = mode;

    airconSetting.power =
        mode !== "OFF";

    updateAirconView();
}

function setAirconFan(fan)
{
    airconSetting.fan = fan;
    updateAirconView();
}

function setSwingV(swing)
{
    airconSetting.swing_v = swing;
    updateAirconView();
}

function setSwingH(swing)
{
    airconSetting.swing_h = swing;
    updateAirconView();
}

function toggleWarp()
{
    airconSetting.warp =
        airconSetting.warp === "ON" ? "OFF" : "ON";

    updateAirconView();
}

function toggleBio()
{
    airconSetting.bio =
        airconSetting.bio === "ON" ? "OFF" : "ON";

    updateAirconView();
}
function applyAircon()
{
    publishMqtt(
        "room/aircon/set",
        JSON.stringify(airconSetting)
    );

    console.log(
        "AIRCON APPLY",
        airconSetting
    );
}
