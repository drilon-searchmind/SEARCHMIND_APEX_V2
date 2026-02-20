export const fmt = (val) =>
    val.toLocaleString("da-DK", {
        style: "currency",
        currency: "DKK",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
    });

export const displayVal = (val, zeroAsDash = true) =>
    zeroAsDash && (val === 0 || val === undefined) ? "-" : fmt(val);

export const percentChange = (prev, curr) =>
    prev !== 0 && prev !== undefined && prev !== null ? ((curr - prev) / prev) * 100 : null;
