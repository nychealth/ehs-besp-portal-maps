// URL to your ArcGIS Online table's REST API endpoint
const tableUrl = 'https://services3.arcgis.com/A6Zjpzrub8ESZ3c7/ArcGIS/rest/services/FS_Active_Commissaries_Table/FeatureServer/0/query?where=1%3D1&outFields=RecordID,CommissaryName,Address,Borough,ZipCode,Phone&f=json';


// Fetch the data from the ArcGIS Online table
fetch(tableUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();  // Parse the JSON from the response
    })
    .then(data => {
        let features = data.features;

// Sort features by Borough first, then CommissaryName (both case-insensitive)
features.sort((a, b) => {
    const boroughA = a.attributes.Borough.toUpperCase(); // Ignore case for Borough
    const boroughB = b.attributes.Borough.toUpperCase(); // Ignore case for Borough
    const nameA = a.attributes.CommissaryName.toUpperCase(); // Ignore case for CommissaryName
    const nameB = b.attributes.CommissaryName.toUpperCase(); // Ignore case for CommissaryName

    // First, compare Borough
    if (boroughA < boroughB) {
        return -1;
    }
    if (boroughA > boroughB) {
        return 1;
    }

    // If Borough is the same, compare CommissaryName
    if (nameA < nameB) {
        return -1;
    }
    if (nameA > nameB) {
        return 1;
    }

    // If both Borough and CommissaryName are the same
    return 0;
});

        let tableHTML = '<table>';
        tableHTML += '<tr><th>Record</th><th>Commissary</th><th>Address</th><th>Borough</th><th>Zip Code</th><th>Phone</th></tr>'; // Replace Field1, Field2, etc. with your actual field names

        // Loop through each feature (row) in the data
        data.features.forEach(feature => {
            tableHTML += `<tr>
                            <td>${feature.attributes.RecordID}</td>
                            <td style="word-wrap: break-word; white-space: normal; max-width: 200px;">${feature.attributes.CommissaryName}</td>
                            <td>${feature.attributes.Address}</td>
							<td>${feature.attributes.Borough}</td>
							<td>${feature.attributes.ZipCode}</td>
							<td>${feature.attributes.Phone}</td>
                          </tr>`;
        });

        tableHTML += '</table>';
        document.getElementById('tableContainer').innerHTML = tableHTML; // Display the table in the HTML element
    })
    .catch(error => console.error('Error fetching data:', error));  // Handle any errors that occur during the fetch
