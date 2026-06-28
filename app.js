const client = mqtt.connect(
    "wss://c33aa709ad5b447381d7574b4db4b5f5.s1.eu.hivemq.cloud:8884/mqtt",
    {
        username: "hikaru",
        password: "HiveMQ1234HiveMQ"
    }
);

client.on(
    "connect",
    () =>
    {
        document
            .getElementById(
                "mqttStatus"
            )
            .innerHTML =
            "● Connected";

        document
            .getElementById(
                "mqttStatus"
            )
            .className =
            "statusOn";

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

        const data =
            JSON.parse(msg);

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

function lightAllOn()
{
    client.publish(
        "room/light/all_on",
        "1"
    );
}

function lightOff()
{
    client.publish(
        "room/light/all_off",
        "1"
    );
}

function lightNight()
{
    client.publish(
        "room/light/night",
        "1"
    );
}

function lightDim()
{
    client.publish(
        "room/light/dim",
        "1"
    );
}

function lightTimer()
{
    client.publish(
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

function updateAirconView()
{
    document.getElementById("airconMode").innerText =
        airconSetting.mode;

    document.getElementById("airconTemp").innerText =
        airconSetting.temperature;
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
}

function setSwingV(swing)
{
    airconSetting.swing_v = swing;
}

function setSwingH(swing)
{
    airconSetting.swing_h = swing;
}

function toggleWarp()
{
    airconSetting.warp =
        airconSetting.warp === "ON" ?
        "OFF" :
        "ON";
}

function toggleBio()
{
    airconSetting.bio =
        airconSetting.bio === "ON" ?
        "OFF" :
        "ON";
}

function applyAircon()
{
    client.publish(
        "room/aircon/set",
        JSON.stringify(airconSetting)
    );

    console.log(
        "AIRCON APPLY",
        airconSetting
    );
}
