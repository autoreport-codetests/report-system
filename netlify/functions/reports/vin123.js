const reportData = {
    vehicleInfo: {
        make: "Honda",
        model: "OK V EX",
        year: "2022",
        vin: "WEIOTTOCSME12SASG",
        mileage: "20,300 miles",
        inspectionDate: "August 21, 2025",
        exteriorColor: "Sonic Gray Pearl",
        interiorColor: "Black",
        engine: "1.5L Turbocharged I4",
        transmission: "CVT"
    }
};

exports.handler = async () => {
    return {
        statusCode: 200,
        body: JSON.stringify(reportData)
    };
};