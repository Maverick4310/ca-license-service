export async function searchDFPI(companyName) {

    return [
        {
            entityName: 'ABC CAPITAL LLC',
            licenseNumber: '60DBO-123456',
            licenseType: 'California Financing Law',
            licenseStatus: 'Active',
            address: '123 Main Street'
        },
        {
            entityName: 'ABC CAPITAL FUNDING LLC',
            licenseNumber: '60DBO-654321',
            licenseType: 'California Financing Law',
            licenseStatus: 'Active',
            address: '456 Market Street'
        },
        {
            entityName: 'ABC CAPITAL GROUP LLC',
            licenseNumber: '60DBO-777777',
            licenseType: 'California Financing Law',
            licenseStatus: 'Inactive',
            address: '789 First Avenue'
        }
    ];
}
