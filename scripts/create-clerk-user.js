const secretKey = 'sk_test_XYSgBW1VjtYRlMPvxlEbVzK6UMLs8hoDuoNRJxI2NS';

async function createUser() {
  console.log('Creating user in Clerk...');
  try {
    const res = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email_address: ['interpretersfree@gmail.com'],
        password: 'FreeInterpreters!2026',
        first_name: 'Admin',
        last_name: 'FreeInterpreters',
        username: 'interpretersfree',
        phone_number: ['+14155552671']
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Failed to create user:', res.status, errorText);
      return;
    }
    
    const data = await res.json();
    console.log('User created successfully in Clerk:', data.id);
  } catch (error) {
    console.error('Error:', error);
  }
}

createUser();
