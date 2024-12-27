import requests
api_key = 'sk-tNuS6BJFPyxQjC0nC3D31a3a23354cC49c790dE532A1B917'
url = 'https://api.guidaodeng.com/v1/chat/completions'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {api_key}'
}
data = {
    'model': 'gpt-4o-mini',
    'messages': [{'role': 'user', 'content': '天空为何是蓝色'}],
}
response = requests.post(url, headers=headers, json=data)
print(response.json())