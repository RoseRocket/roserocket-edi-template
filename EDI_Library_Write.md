# Creating a new EDI file
As the label should indicate, the following will provide some direction when sending 'WRITE' instructions
to the online EDI Library. For guidance in reading existing EDI files, please read the document
 <a href='./EDI_Library_Read.md' target="_blank">"Reading an existing EDI File"</a>.

## Interchange Control Header
The first line of any EDI file begins with 'ISA'.  This is known as the _Interchange Control Header_ and
it contains specific information about the nature of the data; of note is the identification of the
2 parties involved. More information about the segments can be found here:

https://docs.oracle.com/cd/E19398-01/820-1275/agdaw/index.html
