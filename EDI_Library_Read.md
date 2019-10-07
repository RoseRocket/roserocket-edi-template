<a href='./EDI_Library.md'><< Back</a>

# Reading an existing EDI file
As the label should indicate, the following will provide some direction when sending 'READ' instructions
to the online EDI Library. For the generation of a new EDI file, please read the document
 <a href='./EDI_Library_Write.md' target="_blank">"Creating a new EDI File"</a>.

## Table of Contents
<a href="#initial-setup-of-instructions">Initial setup of instructions</a><br />
<a href="#interchange-control-header">Interchange Control Header</a><br />
<a href="#functional-group-header">Functional Group Header</a><br />
<a href="#transaction-set-header">Transaction Set Header</a><br />

<a href="#reading-elements">Reading Elements</a><br />
- <a href="#element-type-tojson">Element Type: toJson</a><br />
- <a href="#element-type-tojsondatetime">Element Type: toJsonDateTime</a><br />
- <a href="#element-type-mapping">Element Type: mapping</a><br />
- <a href="#element-type-ifcase">Element Type: ifCase</a><br />
- <a href="#element-type-skipelement">Element Type: skipElement</a><br />

<a href="#reading-segments-lines-">Reading Segments (lines)</a><br />
- <a href="#segment-type-line">Segment Type: line</a><br />
- <a href="#segment-type-ifline">Segment Type: ifLine</a><br />
- <a href="#segment-type-loopblock">Segment Type: loopBlock</a><br />
- <a href="#segment-type-iblock">Segment Type: ifBlock</a><br />
- <a href="#segment-type-skipline">Segment Type: skipLine</a><br />

## Initial setup of instructions
While this _should_ be standard for all incoming files, our online EDI Library has been opened up to
allow for variations in format. An initial instruction set of the different **delimiters** for both
segments and elements is required for a succesful read. The following can be considered as a static
set of instructions for all of your implementations ("*" for elements, carriage return "\n" for segments):
```
"__edi": {
        "elementTerminator": "*",
        "segmentTerminator": "\n"
    },
```

## Interchange Control Header
The first line of any EDI file begins with **ISA**.  This is known as the _Interchange Control Header_ and
it contains specific information about the nature of the data; of note is the identification of the
2 parties involved. More information about the segments can be found here:

https://docs.oracle.com/cd/E19398-01/820-1275/agdaw/index.html

Since this is a strict requirement of EDI Files, the EDI Library is already preconfigured to receive
and return this data in the result body as the _ediHeader_ attribute. Below is an example ISA header,
with resulting ediHeader data.

```
ISA*00*   *00*   *ZZ*RR   *ZZ*TT    *181222*1940*U*00401*000000014*0*T*>

"ediHeader": {
    "authorizationQualifier": "00",
    "authorizationInformation": "",
    "securityQualifier": "00",
    "securityInformation": "",
    "senderQualifierId": "ZZ",
    "interchangeSenderId": "RR",
    "receiverQualifierId": "ZZ",
    "interchangeReceiverId": "TT",
    "createdDateTime": "2018-12-22T19:40:00.000Z",
    "standardIdentifier": "U",
    "controlVersion": "00401",
    "interchangeControlNumber": "000000014",
    "acknowledgmentRequested": "0",
    "usageIndicator": "T",
    "segmentTerminator": ">"
}
```
## Functional Group Header
Similar to the previous section, functional group headers are also standardized _and_ are also preconfigured
to be read. Prior to outputting the data, you'll find the _groupHeader_ attribute. Example below:
```
GS*SM*RR*TT*20181222*1940*0001*X*004010

"groups": [
    {   // 1st group
        "groupHeader":{
            "functionalIdentifier": "SM",
            "interchangeSenderId": "RR",
            "interchangeReceiverId": "TT",
            "transmissionDate": "2018-12-22T19:40:00.000Z",
            "groupControlNumber": "0001",
            "responsibleAgency": "X",
            "ediVersion": "004010"
        },
        "orders": [ORDERS_RESULT_DATA... (See Below)]
    },
    [...]
]
```

## Transaction Set Header
As before, transaction set headers are standardized _and_ preconfigured to be read. Prior to
outputting the data, you'll find another embedded _groupHeader_ attribute. Example below:
```
ST*204*0001

"orders":[
    {   //1st order
        "groupHeader": {
            "transactionSetId": "204",
            "transactionSetControlNumber": "0001"
        },
        [ORDER_DATA...],
    },
    [...]
]
```

<br />

## Reading Elements
Elements are the building blocks of segments (lines), and in order for the <a href="#reading-segments-lines-">'Reading Segments'</a> section
to make sense, we'll first be looking at the elements that compose them.

If you're familar with an EDI document, or have one handy, you'll know/see that every segment element
has a unique label. In the following example:
```
B10*ID_12345*RR_123*RR
```
Segment **B10** has 3 elements following the **B10** declaration, separated by '*'s.
Most (if not all) EDI documents will label these elements as 'B1001', 'B1002' & 'B1003'.
According to the example above, we have:
```
B1001: ID_12345
B1002: RR_123
B1003: RR
```

In our instructions, we'll be structuring our JSON object to be quite similar.

```
"B10": {
        "type":"line",
        "elements": [
            {
                "name": "B1001",
                "description": "Internal ID",
                "type": "toJson",
                "path": "internal_id"
            },
            {
                "name": "B1002",
                "description": "RoseRocket Order ID",
                "type": "toJson",
                "path": "external_id"
            },
            {
                "name": "B1003",
                "description": "SCAC - Standard Carrier Alpha Code",
                "type": "toJson",
                "path": "scac"
            }
        ]
    },
```

In this example, each element is a straight-forward value => field mapping. **"name/description"** values
are notes/memos to make the instructions more human-readable. _While these are optional_, it is advisable
to keep them.

The **"type"** will tell the library how to interpret the data, and we go into much more detail
below as the type also impacts additional 'required' fields.

The **"path"** will determine the return value label.

Visually, the JSON data returned for this segment will be as follows:
```
"orders": [
    ...
    ...
    "internal_id": "ID_12345",
    "external_id": "RR_123",
    "scac": "RR",
    ...
    ...
]
```
This data is now available for you to consume in your system.

#### The 'PATH' variable
It is also useful to note that **path** variable is an attribute path, meaning that it can be extended
such that nested return values are possible as well. The hope is that this will allow you to configure
the return data to match your personal needs as you see fit.

For example, if we were to change "B1003" above to:

```
{
    "name": "B1003",
    "description": "SCAC - Standard Carrier Alpha Code",
    "type": "toJson",
    "path": "values.scac"  <====== NOTE THE 'values.'
}
```
It will result in the following data structure return:
```
"orders": [
    ...
    ...
    "internal_id": "ID_12345",
    "external_id": "RR_123",
    "values": {
        "scac": "RR",
    }
    ...
    ...
]
```


### Element Types
There are 5 types by which to define a data element: <br />
<a href="#element-type-tojson" >toJson</a> <br />
<a href="#element-type-mapping" >mapping</a> <br />
<a href="#element-type-toJsonDateTime" >toJsonDateTime</a> <br />
<a href="#element-type-ifCase" >ifCase</a> <br />
<a href="#element-type-skipElement" >skipElement</a>

#### Element Type: toJson
This element type has already been described above as a straight-forward value => field mapping.
**"name/description"** values are notes/memos to make the instructions more human-readable.
_While these are optional_, it is advisable to keep them.

#### Element Type: mapping
This 'mapping' type is likely the most complicated as it is used for segments whose labels are 
_context specific_, meaning that the label is dependent on the values within it. If you've been following
along with 

#### Element Type: toJsonDateTime
This element is a value => filed mapping, but a 'dateTimeFormat' (required) field is also necessary.


#### Element Type: ifCase

#### Element Type: skipElement
For simplicity's sake, this is an element that can be ignored and will not generate a return field.


<br />

## Reading Segments (lines)
Segments are our next look at configuration. Based on the order that they are received,
segments can be grouped together to signify a set of data. It's important to identify these
different configurations such that the data is returned properly.

Each segment is identified by the first few characters of every line. For example, in 214 files
(Carrier Shipment Status Messages), **AT7** segments deal with shipment status details. This segment
can be configured in the instructions as follows:
```
"AT7": {
    [SEGMENT READING INSTRUCTIONS...]
}
```

### Segment Types
A segment can fall under 5 'line types':<br />
<a href="#segment-type-line" >Line</a> <br />
<a href="#segment-type-ifline" >ifLine</a> <br />
<a href="#segment-type-loopblock" >loopBlock</a> <br />
<a href="#segment-type-ifblock" >ifBlock</a> <br />
<a href="#segment-type-skipline" >skipLine</a>

#### Segment Type: line
A 'line' segment implies that it is a full set of data, and has no relation to other segments.
Building on our **AT7** example from before, this can be configured as follows:
```
"AT7": {
    "type":"line",
    "elements": [ELEMENT READING INSTRUCTIONS...]
}
```

#### Segment Type: ifLine

#### Segment Type: loopBlock
A 'loopBlock' segment implies that this segment and a set list of following segments are meant to be
grouped together. For example, common groupings include stop details that have stop names, addresses,
and contact information.

It's likely to be far more useful providing the example first in this case and reading along with it,
line-by-line, in order to explain how the data is divied out.
```
"AT7": {
    "type":"line",
    "elements": [ELEMENT READING INSTRUCTIONS...]
}
```

#### Segment Type: ifBlock

#### Segment Type: skipLine
A 'skipLine' segment implies that this information is not essential to your data processing. Certain
segments in EDI files are more confirmation than informative; you already have the corresponding data.
In these instances, if you'd prefer to clean up the return data and not deal with certain segments,
you can set it's type to 'skipLine' and it _will not_ be included in the return data set.
```
"L5": { "type":"skipLine" }
```
