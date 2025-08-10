import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const CREATE_USER: Tool = {
  name: "salesforce_create_user",
  description: `Create a new user in Salesforce. This tool handles user creation with proper validation and required fields.

This tool handles:
1. User creation with required fields (Username, Email, FirstName, LastName, Alias, ProfileId)
2. Optional fields (Phone, Title, Department, etc.)
3. Email validation and username uniqueness
4. Profile assignment and license validation

Examples:
1. Create a standard user:
   - username: "john.doe@company.com"
   - email: "john.doe@company.com"
   - firstName: "John"
   - lastName: "Doe"
   - alias: "jdoe"
   - profileId: "00e000000000000AAA"

2. Create user with additional details:
   - username: "jane.smith@company.com"
   - email: "jane.smith@company.com"
   - firstName: "Jane"
   - lastName: "Smith"
   - alias: "jsmith"
   - profileId: "00e000000000000AAA"
   - title: "Sales Manager"
   - department: "Sales"
   - phone: "+1-555-123-4567"

Important Rules:
- Username must be unique across all Salesforce orgs
- Username must be in email format
- Email must be valid format
- Alias must be unique and max 8 characters
- ProfileId must exist and be active
- User will be created as active by default`,
  inputSchema: {
    type: "object",
    properties: {
      username: {
        type: "string",
        description: "Unique username in email format (required)"
      },
      email: {
        type: "string",
        description: "Valid email address (required)"
      },
      firstName: {
        type: "string",
        description: "User's first name (required)"
      },
      lastName: {
        type: "string",
        description: "User's last name (required)"
      },
      alias: {
        type: "string",
        description: "User alias, max 8 characters (required)"
      },
      profileId: {
        type: "string",
        description: "Salesforce Profile ID (required)"
      },
      title: {
        type: "string",
        description: "Job title (optional)"
      },
      department: {
        type: "string",
        description: "Department name (optional)"
      },
      phone: {
        type: "string",
        description: "Phone number (optional)"
      },
      timeZoneSidKey: {
        type: "string",
        description: "Timezone (defaults to America/New_York)"
      },
      localeSidKey: {
        type: "string",
        description: "Locale (defaults to en_US)"
      },
      emailEncodingKey: {
        type: "string",
        description: "Email encoding (defaults to UTF-8)"
      },
      languageLocaleKey: {
        type: "string",
        description: "Language locale (defaults to en_US)"
      }
    },
    required: ["username", "email", "firstName", "lastName", "alias", "profileId"]
  }
};

export interface CreateUserArgs {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  alias: string;
  profileId: string;
  title?: string;
  department?: string;
  phone?: string;
  timeZoneSidKey?: string;
  localeSidKey?: string;
  emailEncodingKey?: string;
  languageLocaleKey?: string;
}

// Helper function to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper function to validate username format (must be email-like)
function isValidUsername(username: string): boolean {
  return isValidEmail(username);
}

// Helper function to validate alias (max 8 characters, alphanumeric)
function isValidAlias(alias: string): boolean {
  const aliasRegex = /^[a-zA-Z0-9]{1,8}$/;
  return aliasRegex.test(alias);
}

// Helper function to validate Salesforce ID format
function isValidSalesforceId(id: string): boolean {
  const idRegex = /^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/;
  return idRegex.test(id);
}

// Helper function to validate user data
function validateUserData(args: CreateUserArgs): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate required fields
  if (!args.username?.trim()) errors.push("Username is required");
  if (!args.email?.trim()) errors.push("Email is required");
  if (!args.firstName?.trim()) errors.push("First name is required");
  if (!args.lastName?.trim()) errors.push("Last name is required");
  if (!args.alias?.trim()) errors.push("Alias is required");
  if (!args.profileId?.trim()) errors.push("Profile ID is required");

  // Validate formats
  if (args.username && !isValidUsername(args.username)) {
    errors.push("Username must be in valid email format");
  }
  
  if (args.email && !isValidEmail(args.email)) {
    errors.push("Email must be in valid email format");
  }
  
  if (args.alias && !isValidAlias(args.alias)) {
    errors.push("Alias must be alphanumeric and maximum 8 characters");
  }
  
  if (args.profileId && !isValidSalesforceId(args.profileId)) {
    errors.push("Profile ID must be a valid 15 or 18 character Salesforce ID");
  }

  // Validate optional phone format if provided
  if (args.phone && args.phone.trim()) {
    const phoneRegex = /^[\+]?[1-9][\d\-\(\)\s]{7,}$/;
    if (!phoneRegex.test(args.phone)) {
      errors.push("Phone number format is invalid");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper function to construct user object for Salesforce
function constructUserObject(args: CreateUserArgs): any {
  const userObject: any = {
    Username: args.username.trim(),
    Email: args.email.trim(),
    FirstName: args.firstName.trim(),
    LastName: args.lastName.trim(),
    Alias: args.alias.trim(),
    ProfileId: args.profileId.trim(),
    TimeZoneSidKey: args.timeZoneSidKey || 'America/New_York',
    LocaleSidKey: args.localeSidKey || 'en_US',
    EmailEncodingKey: args.emailEncodingKey || 'UTF-8',
    LanguageLocaleKey: args.languageLocaleKey || 'en_US',
    IsActive: true
  };

  // Add optional fields if provided
  if (args.title?.trim()) userObject.Title = args.title.trim();
  if (args.department?.trim()) userObject.Department = args.department.trim();
  if (args.phone?.trim()) userObject.Phone = args.phone.trim();

  return userObject;
}

export async function handleCreateUser(conn: any, args: CreateUserArgs) {
  try {
    // Validate input data
    const validation = validateUserData(args);
    if (!validation.isValid) {
      return {
        content: [{
          type: "text",
          text: `Validation errors:\n${validation.errors.map(error => `- ${error}`).join('\n')}`
        }],
        isError: true,
      };
    }

    // Check if profile exists
    try {
      const profileQuery = `SELECT Id, Name FROM Profile WHERE Id = '${args.profileId}' AND IsActive = true`;
      const profileResult = await conn.query(profileQuery);
      
      if (profileResult.records.length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Profile with ID '${args.profileId}' not found or is inactive`
          }],
          isError: true,
        };
      }
    } catch (profileError) {
      return {
        content: [{
          type: "text",
          text: `Error validating profile: ${profileError instanceof Error ? profileError.message : String(profileError)}`
        }],
        isError: true,
      };
    }

    // Construct user object
    const userObject = constructUserObject(args);

    // Create the user
    const result = await conn.sobject("User").create(userObject);

    if (result.success) {
      return {
        content: [{
          type: "text",
          text: `User created successfully!\n\n` +
                `User ID: ${result.id}\n` +
                `Username: ${args.username}\n` +
                `Email: ${args.email}\n` +
                `Name: ${args.firstName} ${args.lastName}\n` +
                `Alias: ${args.alias}\n` +
                `Profile ID: ${args.profileId}`
        }],
        isError: false,
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `Failed to create user: ${result.errors ? result.errors.join(', ') : 'Unknown error'}`
        }],
        isError: true,
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide more helpful error messages for common issues
    let enhancedError = errorMessage;
    if (errorMessage.includes('DUPLICATE_USERNAME')) {
      enhancedError = `Username '${args.username}' already exists. Usernames must be unique across all Salesforce orgs.`;
    } else if (errorMessage.includes('DUPLICATE_VALUE')) {
      if (errorMessage.includes('Alias')) {
        enhancedError = `Alias '${args.alias}' already exists. Please choose a different alias.`;
      } else if (errorMessage.includes('Email')) {
        enhancedError = `Email '${args.email}' already exists. Please use a different email address.`;
      }
    } else if (errorMessage.includes('INVALID_EMAIL_ADDRESS')) {
      enhancedError = `Invalid email format: '${args.email}'. Please provide a valid email address.`;
    } else if (errorMessage.includes('FIELD_CUSTOM_VALIDATION_EXCEPTION')) {
      enhancedError = `Custom validation rule failed: ${errorMessage}`;
    }

    return {
      content: [{
        type: "text",
        text: `Error creating user: ${enhancedError}`
      }],
      isError: true,
    };
  }
}