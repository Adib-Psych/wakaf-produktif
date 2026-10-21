"""Pure typed decoder extracted verbatim; legacy network and configuration excluded."""
def decode_value(v):
    if not isinstance(v, dict):
        return v
    if "stringValue" in v:    return v["stringValue"]
    if "integerValue" in v:   return int(v["integerValue"])
    if "doubleValue" in v:    return v["doubleValue"]
    if "booleanValue" in v:   return v["booleanValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "nullValue" in v:      return None
    if "referenceValue" in v: return v["referenceValue"]
    if "geoPointValue" in v:  return v["geoPointValue"]
    if "bytesValue" in v:     return v["bytesValue"]
    if "arrayValue" in v:
        return [decode_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v:
        return {k: decode_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    return v
