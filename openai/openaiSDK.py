from openai import OpenAI

client = OpenAI(
    base_url='https://api.guidaodeng.com/v1',
    api_key='sk-tNuS6BJFPyxQjC0nC3D31a3a23354cC49c790dE532A1B917',
)

chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "Say hi",
        }
    ],
    model="gpt-4o",
)

print(chat_completion)
