import { NextResponse } from "next/server";
import {
  compactVrm,
  findValue,
  formatVrm,
  type VehicleDetails,
} from "@/lib/vehicle";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawVrm = typeof body?.vrm === "string" ? body.vrm : "";
    const compact = compactVrm(rawVrm);

    if (!compact || !/^[A-Z0-9]{1,8}$/.test(compact)) {
      return NextResponse.json(
        { error: "Please enter a valid vehicle registration." },
        { status: 400 }
      );
    }

    // The API key is read ONLY here, server-side. It is never sent to the
    // client and must never be hardcoded or exposed via NEXT_PUBLIC_*.
    const apiKey = process.env.VEHICLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vehicle lookup is not configured (missing VEHICLE_API_KEY)." },
        { status: 500 }
      );
    }

    const url = `https://api.checkcardetails.co.uk/vehicledata/vehicleregistration?apikey=${encodeURIComponent(
      apiKey
    )}&vrm=${encodeURIComponent(compact)}`;

    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      // Don't leak the upstream URL/key; return a clean message.
      const msg =
        res.status === 404
          ? "No vehicle found for that registration."
          : "The vehicle lookup service is unavailable right now. Please try again.";
      return NextResponse.json({ error: msg }, { status: res.status === 404 ? 404 : 502 });
    }

    const data = await res.json();

    // Some providers wrap errors in a 200 response — detect an empty payload.
    const make = findValue(data, ["Make"]);
    const model = findValue(data, ["Model"]);
    if (!make && !model) {
      return NextResponse.json(
        { error: "No vehicle details found for that registration." },
        { status: 404 }
      );
    }

    const vehicle: VehicleDetails = {
      vrm: formatVrm(compact),
      make,
      model,
      colour: findValue(data, ["Colour", "Color"]),
      fuelType: findValue(data, ["FuelType", "Fuel"]),
      year: findValue(data, ["YearOfManufacture", "Year"]),
      engineCapacity: findValue(data, ["EngineCapacity", "EngineSize"]),
      motStatus: findValue(data, ["MotStatus", "MOTStatus", "MotExpiryStatus"]),
      motDueDate: findValue(data, ["MotExpiryDate", "MotDueDate", "MOTExpiryDate"]),
      taxStatus: findValue(data, ["TaxStatus", "VehicleStatus"]),
    };

    return NextResponse.json({ vehicle });
  } catch (err) {
    console.error("Vehicle lookup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong looking up that vehicle." },
      { status: 500 }
    );
  }
}
