# Simple API

A flexible and modular REST API that provides a standardized interface to various backend data stores. Built with Node.js, Express, and MySQL, this API automatically generates endpoints for your database tables and handles relationships between entities.

## Features

- 🚀 Automatic REST endpoint generation for database tables
- 🔄 Full CRUD operations support
- 🤝 Built-in relationship management via Clamp table
- 📝 Dynamic query filtering
- 📄 Pagination support
- 🔌 Modular design for multiple database backends
- 🔒 Environment-based configuration

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/simple-api.git
cd simple-api
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the project root:
```bash
cp .env.example .env
```

4. Update the `.env` file with your database credentials:
```env
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=simple_api
DB_PORT=3306
```

## Usage

### Starting the Server

```bash
npm start
```

The server will start on port 3000 by default. You can modify this by setting the `PORT` environment variable.

### API Endpoints

The API automatically generates the following endpoints for each table in your database:

- `GET /api/TABLE_NAME` - Get all records
- `GET /api/TABLE_NAME?pg=0&cnt=100` - Get paginated records
- `GET /api/TABLE_NAME/:id` - Get a specific record
- `PUT /api/TABLE_NAME` - Create a new record
- `POST /api/TABLE_NAME/:id` - Update a record
- `DELETE /api/TABLE_NAME/:id` - Delete a record
- `GET /api/TABLE_NAME/clamp/:localId/:remoteTable/:remoteId` - Create a relationship

### Example Requests

#### Create a New User with Related Employee Record

```json
PUT /api/User
{
    "User": [{
        "UserID": "new",
        "User": "jsmith",
        "Password": "securepass",
        "Name": "John Smith",
        "Phone": "415-555-1212",
        "Employee": {
            "EmployeeID": "new",
            "Employee": "John Smith",
            "Address": "123 Main St",
            "City": "San Francisco",
            "State": "CA",
            "Zip": "94105"
        }
    }]
}
```

#### Update a User

```json
POST /api/User/17
{
    "User": [{
        "UserID": "17",
        "Password": "newpassword",
        "Name": "John Smith Jr"
    }]
}
```

#### Search Users

```json
GET /api/search
{
    "search": {
        "User": {
            "Name": "%john%",
            "Active": 1
        }
    }
}
```

## Database Schema

The API uses a Clamp table for managing relationships:

```sql
CREATE TABLE Clamp (
    id INT PRIMARY KEY AUTO_INCREMENT,
    local VARCHAR(255) NOT NULL,
    local_id INT NOT NULL,
    remote VARCHAR(255) NOT NULL,
    remote_id INT NOT NULL,
    context VARCHAR(255)
);
```

## Development

### Adding Custom Controllers

You can extend the base controller for custom table handling:

```javascript
class CustomUserController extends Boss {
    async beforeCreate(data) {
        // Custom logic before creating a user
        data.Password = await bcrypt.hash(data.Password, 10);
        return data;
    }
}
```

### Running Tests

```bash
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- Express.js team for the excellent web framework
- MySQL team for the robust database system
- All contributors who have helped with the project

## Security

Please note that this is a basic implementation. For production use, you should:

- Implement proper authentication
- Add input validation
- Use HTTPS
- Implement rate limiting
- Add proper error handling
- Sanitize SQL queries
- Implement proper password hashing
