"""
ParkGuard Mock Backend - Mimics Node.js Express API
This is a development mock that mirrors the ParkGuard Node.js backend responses.
"""
import os
import uuid
import bcrypt
import jwt
import json
from datetime import datetime, timezone, timedelta
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI(title="ParkGuard Mock API")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# --- Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str, role: str, expires_days: int = 7) -> str:
    payload = {
        "userId": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=expires_days),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Access token required")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["userId"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {k: v for k, v in user.items() if k != "_id" and k != "password_hash"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def fmt_date(dt=None):
    return (dt or datetime.now(timezone.utc)).isoformat()

# --- Models ---
class RegisterInput(BaseModel):
    name: str
    email: str
    password: str
    phone: str
    address: Optional[str] = None

class LoginInput(BaseModel):
    email: str
    password: str
    rememberMe: Optional[bool] = False

class VehicleInput(BaseModel):
    type: str
    licensePlate: str
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None

class VehicleUpdate(BaseModel):
    type: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None

class IncidentReport(BaseModel):
    vehicleId: str
    incidentType: str
    description: Optional[str] = None
    locationAddress: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str

class CallInitiate(BaseModel):
    vehicleId: str
    callerPhone: str

class CheckoutInput(BaseModel):
    items: list
    shippingAddress: str

class OrderStatusUpdate(BaseModel):
    status: str
    trackingNumber: Optional[str] = None

# --- Startup ---
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.vehicles.create_index("id", unique=True)
    await db.incidents.create_index("id", unique=True)
    await db.orders.create_index("id", unique=True)
    await db.notifications.create_index("user_id")
    
    # Seed admin
    admin = await db.users.find_one({"email": "admin@parkguard.com"})
    if not admin:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id, "name": "Admin", "email": "admin@parkguard.com",
            "password_hash": hash_password("Admin123!"),
            "phone": "+1234567890", "address": "ParkGuard HQ",
            "role": "admin", "is_verified": True, "is_active": True,
            "created_at": fmt_date(), "updated_at": fmt_date()
        })
    
    # Seed test user
    test = await db.users.find_one({"email": "test@example.com"})
    if not test:
        test_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": test_id, "name": "Test User", "email": "test@example.com",
            "password_hash": hash_password("Password123"),
            "phone": "+1987654321", "address": "123 Test St",
            "role": "user", "is_verified": True, "is_active": True,
            "created_at": fmt_date(), "updated_at": fmt_date()
        })
        # Seed a vehicle for test user
        veh_id = str(uuid.uuid4())
        qr_code = str(uuid.uuid4())
        await db.vehicles.insert_one({
            "id": veh_id, "user_id": test_id, "type": "car",
            "brand": "Toyota", "model": "Camry", "year": 2022,
            "color": "Blue", "license_plate": "ABC123", "qr_code": qr_code,
            "is_active": True, "created_at": fmt_date(), "updated_at": fmt_date()
        })
    
    # Seed products
    if await db.products.count_documents({}) == 0:
        products = [
            {"id": str(uuid.uuid4()), "name": "Classic Blue QR Sticker", "description": "Premium quality blue QR sticker with waterproof coating", "price": 12.99, "image_url": None, "design_category": "standard", "inventory_count": 100, "is_active": True, "featured": True, "created_at": fmt_date()},
            {"id": str(uuid.uuid4()), "name": "Metallic Silver QR Sticker", "description": "Sleek metallic silver finish with UV protection", "price": 15.99, "image_url": None, "design_category": "premium", "inventory_count": 50, "is_active": True, "featured": True, "created_at": fmt_date()},
            {"id": str(uuid.uuid4()), "name": "Neon Green QR Sticker", "description": "High visibility neon green for enhanced safety", "price": 18.99, "image_url": None, "design_category": "premium", "inventory_count": 30, "is_active": True, "featured": False, "created_at": fmt_date()},
            {"id": str(uuid.uuid4()), "name": "Premium Gold QR Sticker", "description": "Luxury gold-plated QR sticker for premium vehicles", "price": 24.99, "image_url": None, "design_category": "luxury", "inventory_count": 20, "is_active": True, "featured": True, "created_at": fmt_date()},
            {"id": str(uuid.uuid4()), "name": "Reflective White QR Sticker", "description": "Reflective material for night visibility", "price": 19.99, "image_url": None, "design_category": "premium", "inventory_count": 40, "is_active": True, "featured": False, "created_at": fmt_date()},
        ]
        await db.products.insert_many(products)
    
    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write("# ParkGuard Test Credentials\n\n")
        f.write("## Admin\n- Email: admin@parkguard.com\n- Password: Admin123!\n- Role: admin\n\n")
        f.write("## Test User\n- Email: test@example.com\n- Password: Password123\n- Role: user\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- GET /api/auth/profile\n- PUT /api/auth/update-profile\n- PUT /api/auth/change-password\n- GET /api/auth/verify-token\n- POST /api/auth/logout\n")

# --- Health ---
@app.get("/api/health")
async def health():
    return {"status": "OK", "timestamp": fmt_date(), "environment": "development", "version": "1.0.0"}

@app.get("/api/")
async def root():
    return {"message": "ParkGuard API Server", "status": "running"}

# --- Auth ---
@app.post("/api/auth/register")
async def register(data: RegisterInput):
    existing = await db.users.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=409, detail="User already exists with this email")
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id, "name": data.name.strip(), "email": data.email.lower(),
        "password_hash": hash_password(data.password), "phone": data.phone,
        "address": data.address, "role": "user", "is_verified": False,
        "is_active": True, "created_at": fmt_date(), "updated_at": fmt_date()
    }
    await db.users.insert_one(user)
    token = create_token(user_id, data.email.lower(), "user")
    return {
        "success": True, "message": "User registered successfully",
        "data": {
            "user": {"id": user_id, "name": data.name.strip(), "email": data.email.lower(),
                     "phone": data.phone, "role": "user", "isVerified": False, "createdAt": user["created_at"]},
            "token": token
        }
    }

@app.post("/api/auth/login")
async def login(data: LoginInput):
    user = await db.users.find_one({"email": data.email.lower()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account has been deactivated")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    expires = 30 if data.rememberMe else 7
    token = create_token(user["id"], user["email"], user.get("role", "user"), expires)
    return {
        "success": True, "message": "Login successful",
        "data": {
            "user": {"id": user["id"], "name": user["name"], "email": user["email"],
                     "phone": user["phone"], "role": user.get("role", "user"),
                     "isVerified": user.get("is_verified", False), "createdAt": user["created_at"]},
            "token": token, "expiresIn": f"{expires}d"
        }
    }

@app.get("/api/auth/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    vehicle_count = await db.vehicles.count_documents({"user_id": user["id"], "is_active": True})
    incident_count = await db.incidents.count_documents({"vehicle_owner_id": user["id"]})
    order_count = await db.orders.count_documents({"user_id": user["id"]})
    return {
        "success": True,
        "data": {
            "user": {"id": user["id"], "name": user["name"], "email": user["email"],
                     "phone": user["phone"], "address": user.get("address"),
                     "role": user.get("role", "user"), "isVerified": user.get("is_verified", False),
                     "createdAt": user["created_at"]},
            "stats": {"vehicleCount": vehicle_count, "incidentCount": incident_count, "orderCount": order_count}
        }
    }

@app.put("/api/auth/update-profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    if data.name is not None:
        updates["name"] = data.name.strip()
    if data.phone is not None:
        updates["phone"] = data.phone
    if data.address is not None:
        updates["address"] = data.address.strip() if data.address else None
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    updates["updated_at"] = fmt_date()
    await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"success": True, "message": "Profile updated successfully", "data": {"user": updated}}

@app.put("/api/auth/change-password")
async def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"id": user["id"]})
    if not verify_password(data.currentPassword, full_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(data.newPassword), "updated_at": fmt_date()}})
    return {"success": True, "message": "Password changed successfully"}

@app.get("/api/auth/verify-token")
async def verify_token(user: dict = Depends(get_current_user)):
    return {"success": True, "message": "Token is valid", "data": {"user": user}}

@app.post("/api/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"success": True, "message": "Logout successful"}

# --- Vehicles ---
@app.post("/api/vehicles")
async def create_vehicle(data: VehicleInput, user: dict = Depends(get_current_user)):
    lp = data.licensePlate.upper().replace(" ", "")
    existing = await db.vehicles.find_one({"license_plate": lp})
    if existing:
        raise HTTPException(status_code=409, detail="Vehicle with this license plate already registered")
    count = await db.vehicles.count_documents({"user_id": user["id"], "is_active": True})
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 vehicles allowed per user")
    veh_id = str(uuid.uuid4())
    qr_code = str(uuid.uuid4())
    vehicle = {
        "id": veh_id, "user_id": user["id"], "type": data.type,
        "brand": data.brand, "model": data.model, "year": data.year,
        "color": data.color, "license_plate": lp, "qr_code": qr_code,
        "is_active": True, "created_at": fmt_date(), "updated_at": fmt_date()
    }
    await db.vehicles.insert_one(vehicle)
    frontend_url = os.environ.get("APP_URL", "")
    qr_url = f"{frontend_url}/scan?vehicle={qr_code}"
    resp = {k: v for k, v in vehicle.items() if k != "_id"}
    resp["qrCodeUrl"] = qr_url
    return {"success": True, "message": "Vehicle registered successfully", "data": {"vehicle": resp}}

@app.get("/api/vehicles")
async def list_vehicles(page: int = 1, limit: int = 10, user: dict = Depends(get_current_user)):
    skip = (page - 1) * limit
    query = {"user_id": user["id"], "is_active": True}
    total = await db.vehicles.count_documents(query)
    vehicles = await db.vehicles.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    frontend_url = os.environ.get("APP_URL", "")
    for v in vehicles:
        v["qrCodeUrl"] = f"{frontend_url}/scan?vehicle={v['qr_code']}"
        inc_count = await db.incidents.count_documents({"vehicle_id": v["id"]})
        v["incidentCount"] = inc_count
    total_pages = max(1, (total + limit - 1) // limit)
    return {
        "success": True,
        "data": {
            "vehicles": vehicles,
            "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages,
                          "hasNext": page < total_pages, "hasPrev": page > 1}
        }
    }

@app.get("/api/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str, user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    frontend_url = os.environ.get("APP_URL", "")
    vehicle["qrCodeUrl"] = f"{frontend_url}/scan?vehicle={vehicle['qr_code']}"
    incidents = await db.incidents.find({"vehicle_id": vehicle_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    vehicle["recentIncidents"] = incidents
    vehicle["incidentCount"] = len(incidents)
    return {"success": True, "data": {"vehicle": vehicle}}

@app.put("/api/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: VehicleUpdate, user: dict = Depends(get_current_user)):
    vehicle = await db.vehicles.find_one({"id": vehicle_id, "user_id": user["id"]})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    updates = {k: v for k, v in data.dict(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    updates["updated_at"] = fmt_date()
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": updates})
    updated = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
    frontend_url = os.environ.get("APP_URL", "")
    updated["qrCodeUrl"] = f"{frontend_url}/scan?vehicle={updated['qr_code']}"
    return {"success": True, "message": "Vehicle updated successfully", "data": {"vehicle": updated}}

@app.put("/api/vehicles/{vehicle_id}/deactivate")
async def deactivate_vehicle(vehicle_id: str, user: dict = Depends(get_current_user)):
    result = await db.vehicles.update_one({"id": vehicle_id, "user_id": user["id"]}, {"$set": {"is_active": False, "updated_at": fmt_date()}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True, "message": "Vehicle deactivated successfully"}

@app.delete("/api/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str, user: dict = Depends(get_current_user)):
    result = await db.vehicles.delete_one({"id": vehicle_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"success": True, "message": "Vehicle deleted successfully"}

# --- QR Codes ---
@app.get("/api/qr-codes/scan/{qr_code}")
async def scan_qr(qr_code: str):
    vehicle = await db.vehicles.find_one({"qr_code": qr_code, "is_active": True}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="QR code not found or vehicle inactive")
    owner = await db.users.find_one({"id": vehicle["user_id"]}, {"_id": 0, "password_hash": 0})
    return {
        "success": True,
        "data": {
            "vehicle": {
                "id": vehicle["id"], "type": vehicle["type"], "brand": vehicle.get("brand"),
                "model": vehicle.get("model"), "year": vehicle.get("year"), "color": vehicle.get("color"),
                "licensePlate": vehicle["license_plate"],
                "ownerName": owner["name"] if owner else "Unknown",
                "isVerifiedOwner": owner.get("is_verified", False) if owner else False,
                "registeredDate": vehicle["created_at"]
            }
        }
    }

@app.get("/api/qr-codes/validate/{qr_code}")
async def validate_qr(qr_code: str):
    vehicle = await db.vehicles.find_one({"qr_code": qr_code}, {"_id": 0})
    if not vehicle:
        return {"success": True, "data": {"isValid": False, "message": "QR code not found"}}
    return {"success": True, "data": {"isValid": True, "vehicleType": vehicle["type"], "isActive": vehicle.get("is_active", True), "canReport": vehicle.get("is_active", True)}}

@app.get("/api/qr-codes/products")
async def list_products(category: Optional[str] = None, page: int = 1, limit: int = 20):
    query_filter = {"is_active": True}
    if category:
        query_filter["design_category"] = category
    total = await db.products.count_documents(query_filter)
    skip = (page - 1) * limit
    products = await db.products.find(query_filter, {"_id": 0}).sort("price", 1).skip(skip).limit(limit).to_list(limit)
    cats = await db.products.distinct("design_category", {"is_active": True})
    total_pages = max(1, (total + limit - 1) // limit)
    return {
        "success": True,
        "data": {
            "products": products,
            "categories": [c for c in cats if c],
            "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages,
                          "hasNext": page < total_pages, "hasPrev": page > 1}
        }
    }

@app.get("/api/qr-codes/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id, "is_active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"success": True, "data": {"product": product}}

# --- Incidents ---
@app.post("/api/incidents/report")
async def report_incident(data: IncidentReport):
    vehicle = await db.vehicles.find_one({"id": data.vehicleId, "is_active": True}, {"_id": 0})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found or inactive")
    inc_id = str(uuid.uuid4())
    incident = {
        "id": inc_id, "vehicle_id": data.vehicleId, "vehicle_owner_id": vehicle["user_id"],
        "incident_type": data.incidentType, "description": data.description,
        "location_address": data.locationAddress, "latitude": data.latitude,
        "longitude": data.longitude, "status": "reported",
        "created_at": fmt_date(), "updated_at": fmt_date()
    }
    await db.incidents.insert_one(incident)
    # Create notification
    notif_id = str(uuid.uuid4())
    titles = {"wrong_parking": "Wrong Parking Reported", "obstruction": "Vehicle Obstruction Reported",
              "damage": "Vehicle Damage Reported", "contact": "Contact Request"}
    await db.notifications.insert_one({
        "id": notif_id, "user_id": vehicle["user_id"], "incident_id": inc_id,
        "type": "incident_report", "title": titles.get(data.incidentType, "Incident Reported"),
        "message": f"An incident was reported for vehicle {vehicle['license_plate']}",
        "is_read": False, "created_at": fmt_date()
    })
    return {
        "success": True,
        "message": "Incident reported successfully. Vehicle owner has been notified.",
        "data": {"incident": {"id": inc_id, "type": data.incidentType, "status": "reported", "reportedAt": incident["created_at"]}}
    }

@app.get("/api/incidents/my-reports")
async def get_my_incidents(status: str = "all", page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    query_filter = {"vehicle_owner_id": user["id"]}
    if status != "all":
        query_filter["status"] = status
    total = await db.incidents.count_documents(query_filter)
    skip = (page - 1) * limit
    incidents = await db.incidents.find(query_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # Enrich with vehicle info
    for inc in incidents:
        veh = await db.vehicles.find_one({"id": inc["vehicle_id"]}, {"_id": 0})
        if veh:
            inc["license_plate"] = veh["license_plate"]
            inc["vehicle_type"] = veh["type"]
            inc["brand"] = veh.get("brand")
            inc["model"] = veh.get("model")
            inc["color"] = veh.get("color")
    total_pages = max(1, (total + limit - 1) // limit)
    return {
        "success": True,
        "data": {
            "incidents": incidents,
            "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages,
                          "hasNext": page < total_pages, "hasPrev": page > 1}
        }
    }

@app.get("/api/incidents/stats/summary")
async def incident_stats(user: dict = Depends(get_current_user)):
    base = {"vehicle_owner_id": user["id"]}
    total = await db.incidents.count_documents(base)
    pending = await db.incidents.count_documents({**base, "status": "reported"})
    acknowledged = await db.incidents.count_documents({**base, "status": "acknowledged"})
    resolved = await db.incidents.count_documents({**base, "status": "resolved"})
    wrong_parking = await db.incidents.count_documents({**base, "incident_type": "wrong_parking"})
    obstruction = await db.incidents.count_documents({**base, "incident_type": "obstruction"})
    damage = await db.incidents.count_documents({**base, "incident_type": "damage"})
    contact = await db.incidents.count_documents({**base, "incident_type": "contact"})
    return {
        "success": True,
        "data": {
            "summary": {"totalIncidents": total, "pending": pending, "acknowledged": acknowledged, "resolved": resolved},
            "byType": {"wrongParking": wrong_parking, "obstruction": obstruction, "damage": damage, "contactRequests": contact},
            "dailyIncidents": [], "topVehicles": [], "period": "30d"
        }
    }

@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str, user: dict = Depends(get_current_user)):
    incident = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    veh = await db.vehicles.find_one({"id": incident["vehicle_id"]}, {"_id": 0})
    if veh:
        incident["license_plate"] = veh["license_plate"]
        incident["vehicle_type"] = veh["type"]
    return {"success": True, "data": {"incident": incident}}

@app.put("/api/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(incident_id: str, user: dict = Depends(get_current_user)):
    result = await db.incidents.update_one(
        {"id": incident_id, "vehicle_owner_id": user["id"], "status": "reported"},
        {"$set": {"status": "acknowledged", "updated_at": fmt_date()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found or already acknowledged")
    inc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    return {"success": True, "message": "Incident acknowledged", "data": {"incident": inc}}

@app.put("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str, user: dict = Depends(get_current_user)):
    result = await db.incidents.update_one(
        {"id": incident_id, "vehicle_owner_id": user["id"], "status": {"$ne": "resolved"}},
        {"$set": {"status": "resolved", "resolved_at": fmt_date(), "updated_at": fmt_date()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Incident not found or already resolved")
    inc = await db.incidents.find_one({"id": incident_id}, {"_id": 0})
    return {"success": True, "message": "Incident marked as resolved", "data": {"incident": inc}}

# --- Contact (Mocked VoIP) ---
@app.post("/api/contact/initiate-call")
async def initiate_call(data: CallInitiate):
    vehicle = await db.vehicles.find_one({"id": data.vehicleId, "is_active": True})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    call_sid = f"CA{uuid.uuid4().hex[:30]}"
    return {
        "success": True, "message": "Call initiated successfully (MOCKED)",
        "data": {"callSid": call_sid, "status": "queued", "estimatedWaitTime": 5}
    }

@app.get("/api/contact/call-status/{call_sid}")
async def call_status(call_sid: str):
    return {"success": True, "data": {"status": "completed", "duration": 45, "created_at": fmt_date(), "twilioStatus": None}}

# --- Orders (Mocked Stripe) ---
@app.post("/api/orders/create-checkout")
async def create_checkout(data: CheckoutInput, user: dict = Depends(get_current_user)):
    order_id = str(uuid.uuid4())
    order_number = f"PG-{uuid.uuid4().hex[:8].upper()}"
    total = 0
    order_items = []
    for item in data.items:
        product = await db.products.find_one({"id": item.get("productId")}, {"_id": 0})
        if product:
            qty = item.get("quantity", 1)
            total += product["price"] * qty
            order_items.append({"productId": product["id"], "name": product["name"], "price": product["price"], "quantity": qty})
    order = {
        "id": order_id, "user_id": user["id"], "order_number": order_number,
        "status": "paid", "total_amount": round(total, 2), "items": order_items,
        "shipping_address": data.shippingAddress, "payment_intent_id": f"pi_{uuid.uuid4().hex[:24]}",
        "created_at": fmt_date(), "updated_at": fmt_date()
    }
    await db.orders.insert_one(order)
    return {
        "success": True, "message": "Order created successfully (MOCKED - no actual Stripe charge)",
        "data": {"order": {k: v for k, v in order.items() if k != "_id"}, "checkoutUrl": None}
    }

@app.get("/api/orders/my-orders")
async def my_orders(page: int = 1, limit: int = 10, user: dict = Depends(get_current_user)):
    query_filter = {"user_id": user["id"]}
    total = await db.orders.count_documents(query_filter)
    skip = (page - 1) * limit
    orders = await db.orders.find(query_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total_pages = max(1, (total + limit - 1) // limit)
    return {
        "success": True,
        "data": {
            "orders": orders,
            "pagination": {"page": page, "limit": limit, "total": total, "totalPages": total_pages}
        }
    }

@app.get("/api/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"success": True, "data": {"order": order}}

# --- Notifications ---
@app.get("/api/notifications")
async def get_notifications(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    query_filter = {"user_id": user["id"]}
    total = await db.notifications.count_documents(query_filter)
    skip = (page - 1) * limit
    notifs = await db.notifications.find(query_filter, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({**query_filter, "is_read": False})
    return {"success": True, "data": {"notifications": notifs, "unreadCount": unread, "total": total}}

@app.put("/api/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notif_id, "user_id": user["id"]}, {"$set": {"is_read": True}})
    return {"success": True, "message": "Notification marked as read"}

@app.put("/api/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"], "is_read": False}, {"$set": {"is_read": True}})
    return {"success": True, "message": "All notifications marked as read"}

# --- Admin ---
@app.get("/api/admin/stats")
async def admin_stats(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    users_count = await db.users.count_documents({})
    vehicles_count = await db.vehicles.count_documents({"is_active": True})
    incidents_count = await db.incidents.count_documents({})
    orders_count = await db.orders.count_documents({})
    products_count = await db.products.count_documents({"is_active": True})
    total_revenue = 0
    orders = await db.orders.find({"status": {"$in": ["paid", "processing", "shipped", "delivered"]}}).to_list(1000)
    for o in orders:
        total_revenue += o.get("total_amount", 0)
    return {
        "success": True,
        "data": {
            "totalUsers": users_count, "totalVehicles": vehicles_count,
            "totalIncidents": incidents_count, "totalOrders": orders_count,
            "totalProducts": products_count, "totalRevenue": round(total_revenue, 2),
            "recentOrders": [], "recentIncidents": []
        }
    }

@app.get("/api/admin/orders")
async def admin_orders(page: int = 1, limit: int = 20, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    total = await db.orders.count_documents({})
    skip = (page - 1) * limit
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"success": True, "data": {"orders": orders, "pagination": {"page": page, "limit": limit, "total": total}}}

@app.put("/api/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    updates = {"status": data.status, "updated_at": fmt_date()}
    if data.trackingNumber:
        updates["tracking_number"] = data.trackingNumber
    result = await db.orders.update_one({"id": order_id}, {"$set": updates})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"success": True, "message": f"Order status updated to {data.status}"}

@app.get("/api/admin/products")
async def admin_products(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    return {"success": True, "data": {"products": products}}
