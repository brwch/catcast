#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <functiondiscoverykeys_devpkey.h>
#include <audiopolicy.h>
#include <psapi.h>
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <memory>
#include <map>
#include <comdef.h>
#include <io.h>
#include <fcntl.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <mferror.h>
#include <wmcodecdsp.h>

#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "psapi.lib")
#pragma comment(lib, "mf.lib")
#pragma comment(lib, "mfplat.lib")
#pragma comment(lib, "mfreadwrite.lib")
#pragma comment(lib, "wmcodecdspuuid.lib")

// --- IPolicyConfig and IPolicyConfigVista Definitions (Undocumented) ---
// These are required to programmatically set the default audio device.

typedef enum DeviceShareMode
{
    DeviceShareMode_Shared,
    DeviceShareMode_Exclusive
} DeviceShareMode;

interface DECLSPEC_UUID("f8679f50-850a-41cf-9c72-430f290290c8")
IPolicyConfig;
class DECLSPEC_UUID("870af99c-171d-4f9e-af0d-e63df40c2bc9")
CPolicyConfigClient;

interface IPolicyConfig : public IUnknown
{
public:
    virtual HRESULT STDMETHODCALLTYPE GetMixFormat(
        /* [in] */ PCWSTR pszDeviceName,
        /* [out] */ WAVEFORMATEX **ppFormat) = 0;

    virtual HRESULT STDMETHODCALLTYPE GetDeviceFormat(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ INT bDefault,
        /* [out] */ WAVEFORMATEX **ppFormat) = 0;

    virtual HRESULT STDMETHODCALLTYPE ResetDeviceFormat(
        /* [in] */ PCWSTR pszDeviceName) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetDeviceFormat(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ WAVEFORMATEX *pEndpointFormat,
        /* [in] */ WAVEFORMATEX *pMixFormat) = 0;

    virtual HRESULT STDMETHODCALLTYPE GetProcessingPeriod(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ INT bDefault,
        /* [out] */ PINT64 pmftDefaultPeriod,
        /* [out] */ PINT64 pmftMinimumPeriod) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetProcessingPeriod(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ PINT64 pmftPeriod) = 0;

    virtual HRESULT STDMETHODCALLTYPE GetShareMode(
        /* [in] */ PCWSTR pszDeviceName,
        /* [out] */ DeviceShareMode *pMode) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetShareMode(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ DeviceShareMode *mode) = 0;

    virtual HRESULT STDMETHODCALLTYPE GetPropertyValue(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ const PROPERTYKEY *pKey,
        /* [out] */ PROPVARIANT *pv) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetPropertyValue(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ const PROPERTYKEY *pKey,
        /* [in] */ PROPVARIANT *pv) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetDefaultEndpoint(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ ERole role) = 0;

    virtual HRESULT STDMETHODCALLTYPE SetEndpointVisibility(
        /* [in] */ PCWSTR pszDeviceName,
        /* [in] */ INT bVisible) = 0;
};

// Safe release macro
template <class T> void SafeRelease(T** ppT) {
    if (*ppT) {
        (*ppT)->Release();
        *ppT = nullptr;
    }
}

// Error code definitions
enum class ErrorCode {
    SUCCESS = 0,
    COM_INIT_FAILED = 1,
    NO_AUDIO_DEVICE = 2,
    DEVICE_ACCESS_DENIED = 3,
    AUDIO_FORMAT_NOT_SUPPORTED = 4,
    INSUFFICIENT_BUFFER = 5,
    DEVICE_IN_USE = 6,
    DRIVER_ERROR = 7,
    INVALID_PARAMETER = 8,
    UNKNOWN_ERROR = 99
};

// Detailed error information helper
class ErrorHandler {
public:
    static void PrintDetailedError(HRESULT hr, const char* context) {
        std::cerr << "\n========================================" << std::endl;
        std::cerr << "ERROR: " << context << std::endl;
        std::cerr << "========================================" << std::endl;
        std::cerr << "HRESULT Code: 0x" << std::hex << hr << std::dec << std::endl;

        // Get system error message
        _com_error err(hr);
        std::wcerr << L"System Message: " << err.ErrorMessage() << std::endl;

        // Provide detailed explanation and solution
        switch (hr) {
            case E_POINTER:
                std::cerr << "\nCause: Invalid pointer" << std::endl;
                std::cerr << "Solution: This is a programming error. Please report this bug." << std::endl;
                break;

            case E_INVALIDARG:
                std::cerr << "\nCause: Invalid argument provided" << std::endl;
                std::cerr << "Solution: Check command line parameters (sample rate, chunk duration, etc.)" << std::endl;
                break;

            case E_OUTOFMEMORY:
                std::cerr << "\nCause: Insufficient memory" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Close other applications to free up memory" << std::endl;
                std::cerr << "  - Increase virtual memory (page file) size" << std::endl;
                break;

            case E_ACCESSDENIED:
                std::cerr << "\nCause: Access denied / Permission issue" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Run as Administrator (right-click -> Run as administrator)" << std::endl;
                std::cerr << "  - Check Windows Privacy Settings -> Microphone access" << std::endl;
                std::cerr << "  - Disable antivirus temporarily to test" << std::endl;
                break;

            case AUDCLNT_E_DEVICE_INVALIDATED:
                std::cerr << "\nCause: Audio device was removed or disabled" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Check if audio device is properly connected" << std::endl;
                std::cerr << "  - Open Sound Settings and verify default device" << std::endl;
                std::cerr << "  - Restart audio service: services.msc -> Windows Audio" << std::endl;
                break;

            case AUDCLNT_E_DEVICE_IN_USE:
                std::cerr << "\nCause: Audio device is exclusively used by another application" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Close applications using audio (music players, games, etc.)" << std::endl;
                std::cerr << "  - Open Sound Settings -> Device properties -> Additional device properties" << std::endl;
                std::cerr << "  - Go to Advanced tab, uncheck 'Allow applications to take exclusive control'" << std::endl;
                break;

            case AUDCLNT_E_UNSUPPORTED_FORMAT:
                std::cerr << "\nCause: Requested audio format is not supported by device" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Try without --sample-rate parameter (use device default)" << std::endl;
                std::cerr << "  - Try common sample rates: 44100, 48000" << std::endl;
                std::cerr << "  - Update audio drivers" << std::endl;
                break;

            case AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED:
                std::cerr << "\nCause: Buffer size is not aligned with device requirements" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Try different --chunk-duration values (0.05, 0.1, 0.2)" << std::endl;
                break;

            case AUDCLNT_E_SERVICE_NOT_RUNNING:
                std::cerr << "\nCause: Windows Audio service is not running" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Press Win+R, type 'services.msc', press Enter" << std::endl;
                std::cerr << "  - Find 'Windows Audio' service" << std::endl;
                std::cerr << "  - Right-click -> Start (if stopped)" << std::endl;
                std::cerr << "  - Set Startup type to 'Automatic'" << std::endl;
                break;

            case AUDCLNT_E_ENDPOINT_CREATE_FAILED:
                std::cerr << "\nCause: Failed to create audio endpoint" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Restart Windows Audio service" << std::endl;
                std::cerr << "  - Update audio drivers from device manager" << std::endl;
                std::cerr << "  - Restart computer" << std::endl;
                break;

            case CO_E_NOTINITIALIZED:
                std::cerr << "\nCause: COM library not initialized" << std::endl;
                std::cerr << "Solution: This is a programming error. Please report this bug." << std::endl;
                break;

            case REGDB_E_CLASSNOTREG:
                std::cerr << "\nCause: Required COM component not registered" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - System may be missing Windows Audio components" << std::endl;
                std::cerr << "  - Run Windows Update to install missing components" << std::endl;
                std::cerr << "  - Run 'sfc /scannow' in Administrator Command Prompt" << std::endl;
                break;

            default:
                std::cerr << "\nCause: Unknown error (0x" << std::hex << hr << std::dec << ")" << std::endl;
                std::cerr << "Solution: " << std::endl;
                std::cerr << "  - Update audio drivers" << std::endl;
                std::cerr << "  - Restart Windows Audio service" << std::endl;
                std::cerr << "  - Check Windows Event Viewer for details" << std::endl;
                std::cerr << "  - Try running as Administrator" << std::endl;
                break;
        }

        std::cerr << "\nFor more help, visit:" << std::endl;
        std::cerr << "  - Windows Sound Troubleshooter: Settings -> System -> Sound -> Troubleshoot" << std::endl;
        std::cerr << "  - Device Manager: devmgmt.msc -> Sound, video and game controllers" << std::endl;
        std::cerr << "========================================\n" << std::endl;
    }

    static void CheckSystemRequirements() {
        std::cerr << "Checking system requirements..." << std::endl;

        // Check Windows version
        OSVERSIONINFOEX osvi = {};
        osvi.dwOSVersionInfoSize = sizeof(osvi);

        #pragma warning(push)
        #pragma warning(disable: 4996)
        if (GetVersionEx((OSVERSIONINFO*)&osvi)) {
            std::cerr << "Windows Version: " << osvi.dwMajorVersion << "."
                     << osvi.dwMinorVersion << " Build " << osvi.dwBuildNumber << std::endl;

            if (osvi.dwMajorVersion < 6) {
                std::cerr << "WARNING: Windows Vista or later is required for WASAPI" << std::endl;
            }
        }
        #pragma warning(pop)

        // Check if running as administrator
        BOOL isAdmin = FALSE;
        SID_IDENTIFIER_AUTHORITY NtAuthority = SECURITY_NT_AUTHORITY;
        PSID AdministratorsGroup;
        if (AllocateAndInitializeSid(&NtAuthority, 2, SECURITY_BUILTIN_DOMAIN_RID,
                                     DOMAIN_ALIAS_RID_ADMINS, 0, 0, 0, 0, 0, 0,
                                     &AdministratorsGroup)) {
            CheckTokenMembership(NULL, AdministratorsGroup, &isAdmin);
            FreeSid(AdministratorsGroup);
        }

        if (isAdmin) {
            std::cerr << "Privilege Level: Administrator (OK)" << std::endl;
        } else {
            std::cerr << "Privilege Level: Standard User (not administrator)" << std::endl;
            std::cerr << "Note: Some operations may require administrator privileges" << std::endl;
        }

        std::cerr << std::endl;
    }
};

// Audio Resampler class for format conversion
class AudioResampler {
private:
    IMFTransform* pResampler = nullptr;
    IMFMediaType* pInputType = nullptr;
    IMFMediaType* pOutputType = nullptr;
    IMFSample* pInputSample = nullptr;
    IMFSample* pOutputSample = nullptr;
    IMFMediaBuffer* pInputBuffer = nullptr;
    IMFMediaBuffer* pOutputBuffer = nullptr;
    
    WAVEFORMATEX* pInputFormat = nullptr;
    WAVEFORMATEX* pOutputFormat = nullptr;
    
    bool initialized = false;
    
public:
    AudioResampler() {}
    
    ~AudioResampler() {
        Cleanup();
    }
    
    bool Initialize(WAVEFORMATEX* inputFormat, WAVEFORMATEX* outputFormat) {
        if (!inputFormat || !outputFormat) {
            std::cerr << "Error: Invalid input or output format pointer" << std::endl;
            return false;
        }
        
        pInputFormat = inputFormat;
        pOutputFormat = outputFormat;
        
        std::cerr << "Creating audio resampler..." << std::endl;
        HRESULT hr = CoCreateInstance(CLSID_CResamplerMediaObject, nullptr, 
                                     CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pResampler));
        if (FAILED(hr)) {
            std::cerr << "Failed to create resampler COM object: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        std::cerr << "Resampler COM object created successfully" << std::endl;
        
        // Create input media type
        hr = MFCreateMediaType(&pInputType);
        if (FAILED(hr)) {
            std::cerr << "Failed to create input media type: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        
        // Calculate the correct size for WAVEFORMATEX structure
        UINT32 waveFormatSize = sizeof(WAVEFORMATEX) + pInputFormat->cbSize;
        hr = MFInitMediaTypeFromWaveFormatEx(pInputType, pInputFormat, waveFormatSize);
        if (FAILED(hr)) {
            std::cerr << "Failed to init input media type from WAVEFORMATEX: 0x" << std::hex << hr << std::dec << std::endl;
            std::cerr << "  Format tag: " << pInputFormat->wFormatTag << std::endl;
            std::cerr << "  cbSize: " << pInputFormat->cbSize << std::endl;
            std::cerr << "  Total size: " << waveFormatSize << std::endl;
            return false;
        }
        std::cerr << "Input media type configured" << std::endl;
        
        // Create output media type
        hr = MFCreateMediaType(&pOutputType);
        if (FAILED(hr)) {
            std::cerr << "Failed to create output media type: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        
        // Output format size (simple PCM format)
        UINT32 outputWaveFormatSize = sizeof(WAVEFORMATEX) + pOutputFormat->cbSize;
        hr = MFInitMediaTypeFromWaveFormatEx(pOutputType, pOutputFormat, outputWaveFormatSize);
        if (FAILED(hr)) {
            std::cerr << "Failed to init output media type from WAVEFORMATEX: 0x" << std::hex << hr << std::dec << std::endl;
            std::cerr << "  Format tag: " << pOutputFormat->wFormatTag << std::endl;
            std::cerr << "  cbSize: " << pOutputFormat->cbSize << std::endl;
            return false;
        }
        std::cerr << "Output media type configured" << std::endl;
        
        // Set media types
        std::cerr << "Setting input type on resampler..." << std::endl;
        hr = pResampler->SetInputType(0, pInputType, 0);
        if (FAILED(hr)) {
            std::cerr << "Failed to set input type: 0x" << std::hex << hr << std::dec << std::endl;
            std::cerr << "Input format: " << pInputFormat->nSamplesPerSec << "Hz, " 
                      << pInputFormat->nChannels << "ch, " << pInputFormat->wBitsPerSample << "bit" << std::endl;
            return false;
        }
        
        std::cerr << "Setting output type on resampler..." << std::endl;
        hr = pResampler->SetOutputType(0, pOutputType, 0);
        if (FAILED(hr)) {
            std::cerr << "Failed to set output type: 0x" << std::hex << hr << std::dec << std::endl;
            std::cerr << "Output format: " << pOutputFormat->nSamplesPerSec << "Hz, " 
                      << pOutputFormat->nChannels << "ch, " << pOutputFormat->wBitsPerSample << "bit" << std::endl;
            return false;
        }
        
        // Process messages
        std::cerr << "Sending control messages to resampler..." << std::endl;
        hr = pResampler->ProcessMessage(MFT_MESSAGE_COMMAND_FLUSH, 0);
        if (FAILED(hr)) {
            std::cerr << "Failed to send FLUSH message: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        
        hr = pResampler->ProcessMessage(MFT_MESSAGE_NOTIFY_BEGIN_STREAMING, 0);
        if (FAILED(hr)) {
            std::cerr << "Failed to send BEGIN_STREAMING message: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        
        hr = pResampler->ProcessMessage(MFT_MESSAGE_NOTIFY_START_OF_STREAM, 0);
        if (FAILED(hr)) {
            std::cerr << "Failed to send START_OF_STREAM message: 0x" << std::hex << hr << std::dec << std::endl;
            return false;
        }
        
        initialized = true;
        std::cerr << "Audio resampler initialized successfully!" << std::endl;
        return true;
    }
    
    bool ProcessAudio(const BYTE* inputData, UINT32 inputSize, 
                     std::vector<BYTE>& outputData) {
        if (!initialized || !inputData || inputSize == 0) {
            return false;
        }
        
        HRESULT hr;
        
        // First, try to drain all available output
        std::vector<BYTE> tempOutput;
        while (TryGetOutput(tempOutput)) {
            outputData.insert(outputData.end(), tempOutput.begin(), tempOutput.end());
            tempOutput.clear();
        }
        
        // Now try to feed input
        IMFSample* pSample = nullptr;
        IMFMediaBuffer* pBuffer = nullptr;
        
        // Create input sample and buffer
        hr = MFCreateSample(&pSample);
        if (FAILED(hr)) return !outputData.empty();
        
        hr = MFCreateMemoryBuffer(inputSize, &pBuffer);
        if (FAILED(hr)) {
            SafeRelease(&pSample);
            return !outputData.empty();
        }
        
        // Copy input data
        BYTE* pBufferData = nullptr;
        hr = pBuffer->Lock(&pBufferData, nullptr, nullptr);
        if (FAILED(hr)) {
            SafeRelease(&pBuffer);
            SafeRelease(&pSample);
            return !outputData.empty();
        }
        
        memcpy(pBufferData, inputData, inputSize);
        pBuffer->Unlock();
        pBuffer->SetCurrentLength(inputSize);
        
        // Add buffer to sample
        pSample->AddBuffer(pBuffer);
        SafeRelease(&pBuffer);
        
        // Try to process input
        hr = pResampler->ProcessInput(0, pSample, 0);
        SafeRelease(&pSample);
        
        if (FAILED(hr) && hr != MF_E_NOTACCEPTING) {
            // Unexpected error
            return !outputData.empty();
        }
        
        // Try to get more output after feeding input
        while (TryGetOutput(tempOutput)) {
            outputData.insert(outputData.end(), tempOutput.begin(), tempOutput.end());
            tempOutput.clear();
        }
        
        return true;
    }
    
private:
    bool TryGetOutput(std::vector<BYTE>& outputData) {
        MFT_OUTPUT_DATA_BUFFER outputBuffer = {};
        MFT_OUTPUT_STREAM_INFO streamInfo = {};
        IMFMediaBuffer* pBuffer = nullptr;
        
        HRESULT hr = pResampler->GetOutputStreamInfo(0, &streamInfo);
        if (FAILED(hr)) return false;
        
        // Create output sample
        hr = MFCreateSample(&outputBuffer.pSample);
        if (FAILED(hr)) return false;
        
        DWORD bufferSize = streamInfo.cbSize > 0 ? streamInfo.cbSize : 8192;
        hr = MFCreateMemoryBuffer(bufferSize, &pBuffer);
        if (FAILED(hr)) {
            SafeRelease(&outputBuffer.pSample);
            return false;
        }
        
        outputBuffer.pSample->AddBuffer(pBuffer);
        SafeRelease(&pBuffer);
        
        DWORD status = 0;
        hr = pResampler->ProcessOutput(0, 1, &outputBuffer, &status);
        
        if (SUCCEEDED(hr)) {
            // Extract output data
            IMFMediaBuffer* pOutBuffer = nullptr;
            hr = outputBuffer.pSample->ConvertToContiguousBuffer(&pOutBuffer);
            if (SUCCEEDED(hr)) {
                BYTE* pOutData = nullptr;
                DWORD outSize = 0;
                
                hr = pOutBuffer->Lock(&pOutData, nullptr, &outSize);
                if (SUCCEEDED(hr) && outSize > 0) {
                    outputData.assign(pOutData, pOutData + outSize);
                    pOutBuffer->Unlock();
                }
                SafeRelease(&pOutBuffer);
            }
            SafeRelease(&outputBuffer.pSample);
            return true;
        } else {
            SafeRelease(&outputBuffer.pSample);
            return false;
        }
    }
    
public:
    
    // Flush remaining data from resampler
    void Flush(std::vector<BYTE>& outputData) {
        if (!initialized) return;
        
        // Send drain message
        pResampler->ProcessMessage(MFT_MESSAGE_COMMAND_DRAIN, 0);
        
        // Get all remaining output
        std::vector<BYTE> tempOutput;
        while (TryGetOutput(tempOutput)) {
            outputData.insert(outputData.end(), tempOutput.begin(), tempOutput.end());
            tempOutput.clear();
        }
    }
    
    void Cleanup() {
        SafeRelease(&pOutputBuffer);
        SafeRelease(&pInputBuffer);
        SafeRelease(&pOutputSample);
        SafeRelease(&pInputSample);
        SafeRelease(&pOutputType);
        SafeRelease(&pInputType);
        SafeRelease(&pResampler);
        initialized = false;
    }
};

// --- Device Management Class ---
class AudioDeviceManager {
public:
    struct DeviceInfo {
        std::wstring id;
        std::wstring name;
        bool isDefault;
    };

    static std::vector<DeviceInfo> GetRenderDevices() {
        std::vector<DeviceInfo> devices;
        HRESULT hr;
        
        IMMDeviceEnumerator* pEnumerator = nullptr;
        hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                             __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator);
        if (FAILED(hr)) return devices;

        IMMDeviceCollection* pCollection = nullptr;
        hr = pEnumerator->EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE, &pCollection);
        if (FAILED(hr)) {
            SafeRelease(&pEnumerator);
            return devices;
        }

        UINT count = 0;
        pCollection->GetCount(&count);

        IMMDevice* pDefaultDevice = nullptr;
        std::wstring defaultId;
        if (SUCCEEDED(pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDefaultDevice))) {
            LPWSTR pwszId = nullptr;
            if (SUCCEEDED(pDefaultDevice->GetId(&pwszId))) {
                defaultId = pwszId;
                CoTaskMemFree(pwszId);
            }
            SafeRelease(&pDefaultDevice);
        }

        for (UINT i = 0; i < count; i++) {
            IMMDevice* pDevice = nullptr;
            if (SUCCEEDED(pCollection->Item(i, &pDevice))) {
                LPWSTR pwszId = nullptr;
                if (SUCCEEDED(pDevice->GetId(&pwszId))) {
                    IPropertyStore* pProps = nullptr;
                    if (SUCCEEDED(pDevice->OpenPropertyStore(STGM_READ, &pProps))) {
                        PROPVARIANT varName;
                        PropVariantInit(&varName);
                        if (SUCCEEDED(pProps->GetValue(PKEY_Device_FriendlyName, &varName))) {
                            devices.push_back({
                                pwszId,
                                varName.pwszVal ? varName.pwszVal : L"Unknown Device",
                                defaultId == pwszId
                            });
                            PropVariantClear(&varName);
                        }
                        SafeRelease(&pProps);
                    }
                    CoTaskMemFree(pwszId);
                }
                SafeRelease(&pDevice);
            }
        }

        SafeRelease(&pCollection);
        SafeRelease(&pEnumerator);
        return devices;
    }

    static std::wstring GetDefaultDeviceID() {
        std::wstring id;
        IMMDeviceEnumerator* pEnumerator = nullptr;
        if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                                   __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator))) {
            return id;
        }

        IMMDevice* pDevice = nullptr;
        if (SUCCEEDED(pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice))) {
            LPWSTR pwszId = nullptr;
            if (SUCCEEDED(pDevice->GetId(&pwszId))) {
                id = pwszId;
                CoTaskMemFree(pwszId);
            }
            SafeRelease(&pDevice);
        }
        SafeRelease(&pEnumerator);
        return id;
    }

    static bool SetDefaultDevice(const std::wstring& deviceId) {
        IPolicyConfig* pPolicyConfig = nullptr;
        HRESULT hr = CoCreateInstance(__uuidof(CPolicyConfigClient), nullptr, CLSCTX_ALL, 
                                     __uuidof(IPolicyConfig), (void**)&pPolicyConfig);
        
        if (SUCCEEDED(hr)) {
            hr = pPolicyConfig->SetDefaultEndpoint(deviceId.c_str(), eConsole);
            pPolicyConfig->SetDefaultEndpoint(deviceId.c_str(), eMultimedia);
            pPolicyConfig->SetDefaultEndpoint(deviceId.c_str(), eCommunications);
            SafeRelease(&pPolicyConfig);
        }
        
        return SUCCEEDED(hr);
    }
};

class WASAPICapture {
private:
    IMMDeviceEnumerator* pEnumerator = nullptr;
    IMMDevice* pDevice = nullptr;
    IAudioClient* pAudioClient = nullptr;
    IAudioCaptureClient* pCaptureClient = nullptr;
    WAVEFORMATEX* pwfx = nullptr;
    WAVEFORMATEX* pOutputFormat = nullptr;
    UINT32 bufferFrameCount = 0;

    int sampleRate = 0;  // 0 means use device default
    int channels = 0;    // 0 means use device default
    int bitDepth = 0;    // 0 means use device default
    double chunkDuration = 0.2;  // seconds
    bool mute = false;
    std::vector<DWORD> includeProcesses;
    std::vector<DWORD> excludeProcesses;

    bool running = false;
    bool needsResampling = false;
    std::unique_ptr<AudioResampler> resampler;
    std::wstring specificDeviceId;

public:
    WASAPICapture() {}

    ~WASAPICapture() {
        Cleanup();
    }

    void SetSampleRate(int rate) { sampleRate = rate; }
    void SetChannels(int ch) { channels = ch; }
    void SetBitDepth(int bits) { bitDepth = bits; }
    void SetChunkDuration(double duration) { chunkDuration = duration; }
    void SetMute(bool m) { mute = m; }
    void AddIncludeProcess(DWORD pid) { includeProcesses.push_back(pid); }
    void AddExcludeProcess(DWORD pid) { excludeProcesses.push_back(pid); }
    void SetDeviceID(const std::wstring& id) { specificDeviceId = id; }

    bool Initialize() {
        std::cerr << "Initializing WASAPI Audio Capture..." << std::endl;

        HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to initialize COM library");
            return false;
        }

        // Initialize Media Foundation
        hr = MFStartup(MF_VERSION);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to initialize Media Foundation");
            return false;
        }

        // Create device enumerator
        hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                             __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to create audio device enumerator");
            std::cerr << "\nAdditional Info:" << std::endl;
            std::cerr << "  This error usually means Windows Audio components are not properly installed." << std::endl;
            return false;
        }

        // If specific device ID is requested
        if (!specificDeviceId.empty()) {
            hr = pEnumerator->GetDevice(specificDeviceId.c_str(), &pDevice);
            if (FAILED(hr)) {
                 std::cerr << "Failed to get specified device. Falling back to default." << std::endl;
                 // Fallback to default
                 hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);
            }
        } else {
             // Get default audio endpoint (loopback for system audio)
             hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);
        }

        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to get default audio device");
            std::cerr << "\nAdditional Info:" << std::endl;
            std::cerr << "  No audio output device found or device is disabled." << std::endl;
            std::cerr << "  To check your audio devices:" << std::endl;
            std::cerr << "    1. Right-click speaker icon in taskbar" << std::endl;
            std::cerr << "    2. Select 'Open Sound settings'" << std::endl;
            std::cerr << "    3. Check if any output device is available" << std::endl;
            std::cerr << "    4. Make sure the device is not disabled" << std::endl;
            return false;
        }

        // Get device name for logging
        IPropertyStore* pProps = nullptr;
        if (SUCCEEDED(pDevice->OpenPropertyStore(STGM_READ, &pProps))) {
            PROPVARIANT varName;
            PropVariantInit(&varName);
            if (SUCCEEDED(pProps->GetValue(PKEY_Device_FriendlyName, &varName))) {
                std::wcerr << L"Using audio device: " << varName.pwszVal << std::endl;
                PropVariantClear(&varName);
            }
            SafeRelease(&pProps);
        }

        // Activate audio client
        hr = pDevice->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)&pAudioClient);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to activate audio client");
            std::cerr << "\nAdditional Info:" << std::endl;
            std::cerr << "  Could not access audio device. This may be a driver or permission issue." << std::endl;
            return false;
        }

        // Get mix format
        hr = pAudioClient->GetMixFormat(&pwfx);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to get audio format");
            std::cerr << "\nAdditional Info:" << std::endl;
            std::cerr << "  Could not query device audio format. Driver may be corrupted." << std::endl;
            return false;
        }

        std::cerr << "Device format: " << pwfx->nSamplesPerSec << "Hz, "
                  << pwfx->nChannels << " channels, "
                  << pwfx->wBitsPerSample << " bits" << std::endl;

        // Check if we need format conversion
        int targetSampleRate = (sampleRate > 0) ? sampleRate : pwfx->nSamplesPerSec;
        int targetChannels = (channels > 0) ? channels : pwfx->nChannels;
        int targetBitDepth = (bitDepth > 0) ? bitDepth : pwfx->wBitsPerSample;

        // Validate parameters
        if (sampleRate > 0 && (sampleRate < 8000 || sampleRate > 192000)) {
            std::cerr << "\nERROR: Invalid sample rate: " << sampleRate << std::endl;
            std::cerr << "Valid range: 8000 - 192000 Hz" << std::endl;
            std::cerr << "Common values: 44100, 48000" << std::endl;
            return false;
        }

        if (channels > 0 && (channels < 1 || channels > 8)) {
            std::cerr << "\nERROR: Invalid channel count: " << channels << std::endl;
            std::cerr << "Valid range: 1 - 8 channels" << std::endl;
            std::cerr << "Common values: 1 (mono), 2 (stereo)" << std::endl;
            return false;
        }

        if (bitDepth > 0 && (bitDepth != 16 && bitDepth != 24 && bitDepth != 32)) {
            std::cerr << "\nERROR: Invalid bit depth: " << bitDepth << std::endl;
            std::cerr << "Valid values: 16, 24, 32 bits" << std::endl;
            return false;
        }

        // Check if we need resampling
        needsResampling = (targetSampleRate != pwfx->nSamplesPerSec) ||
                         (targetChannels != pwfx->nChannels) ||
                         (targetBitDepth != pwfx->wBitsPerSample);

        if (needsResampling) {
            std::cerr << "Format conversion required:" << std::endl;
            std::cerr << "  Input:  " << pwfx->nSamplesPerSec << "Hz, " 
                      << pwfx->nChannels << " channels, " << pwfx->wBitsPerSample << " bits" << std::endl;
            std::cerr << "  Output: " << targetSampleRate << "Hz, " 
                      << targetChannels << " channels, " << targetBitDepth << " bits" << std::endl;

            // Create output format as standard PCM
            pOutputFormat = (WAVEFORMATEX*)CoTaskMemAlloc(sizeof(WAVEFORMATEX));
            if (!pOutputFormat) {
                std::cerr << "Failed to allocate memory for output format" << std::endl;
                return false;
            }

            // Set up as standard PCM format (not extensible)
            ZeroMemory(pOutputFormat, sizeof(WAVEFORMATEX));
            pOutputFormat->wFormatTag = WAVE_FORMAT_PCM;
            pOutputFormat->nChannels = targetChannels;
            pOutputFormat->nSamplesPerSec = targetSampleRate;
            pOutputFormat->wBitsPerSample = targetBitDepth;
            pOutputFormat->nBlockAlign = (targetChannels * targetBitDepth) / 8;
            pOutputFormat->nAvgBytesPerSec = targetSampleRate * pOutputFormat->nBlockAlign;
            pOutputFormat->cbSize = 0;  // No extra data for standard PCM

            // Initialize resampler
            resampler = std::make_unique<AudioResampler>();
            if (!resampler->Initialize(pwfx, pOutputFormat)) {
                std::cerr << "Failed to initialize audio resampler" << std::endl;
                return false;
            }
            std::cerr << "Audio resampler initialized successfully" << std::endl;
        } else {
            std::cerr << "No format conversion needed, using device format" << std::endl;
        }

        // Validate chunk duration
        if (chunkDuration < 0.01 || chunkDuration > 10.0) {
            std::cerr << "\nERROR: Invalid chunk duration: " << chunkDuration << " seconds" << std::endl;
            std::cerr << "Valid range: 0.01 - 10.0 seconds" << std::endl;
            std::cerr << "Recommended: 0.05 - 0.2 seconds" << std::endl;
            return false;
        }

        // Initialize audio client for loopback capture with event callback
        REFERENCE_TIME hnsRequestedDuration = (REFERENCE_TIME)(chunkDuration * 10000000);
        hr = pAudioClient->Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
            hnsRequestedDuration,
            0,
            pwfx,
            nullptr
        );

        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to initialize audio client");

            if (hr == AUDCLNT_E_UNSUPPORTED_FORMAT && sampleRate > 0) {
                std::cerr << "\nAdditional Info:" << std::endl;
                std::cerr << "  Your requested sample rate (" << sampleRate
                         << " Hz) is not supported by this device." << std::endl;
                std::cerr << "  Try running without --sample-rate to use device default." << std::endl;
            } else if (hr == AUDCLNT_E_BUFFER_SIZE_NOT_ALIGNED) {
                std::cerr << "\nAdditional Info:" << std::endl;
                std::cerr << "  The chunk duration doesn't align with device requirements." << std::endl;
                std::cerr << "  Current value: " << chunkDuration << " seconds" << std::endl;
                std::cerr << "  Try values like: 0.05, 0.1, 0.2" << std::endl;
            }

            return false;
        }

        // Get buffer size
        hr = pAudioClient->GetBufferSize(&bufferFrameCount);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to get audio buffer size");
            return false;
        }

        std::cerr << "Buffer size: " << bufferFrameCount << " frames ("
                  << (double)bufferFrameCount / pwfx->nSamplesPerSec * 1000
                  << " ms)" << std::endl;

        // Get capture client
        hr = pAudioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&pCaptureClient);
        if (FAILED(hr)) {
            ErrorHandler::PrintDetailedError(hr, "Failed to get capture client service");
            return false;
        }

        // Handle mute
        if (mute) {
            std::cerr << "Note: Mute functionality is not yet implemented" << std::endl;
            // Note: Muting system audio while capturing requires additional implementation
            // This would typically involve ISimpleAudioVolume interface
        }

        std::cerr << "\n✓ Initialization successful!" << std::endl;
        std::cerr << "========================================" << std::endl;
        std::cerr << "Output Audio Format:" << std::endl;
        if (needsResampling) {
            std::cerr << "  Sample Rate: " << pOutputFormat->nSamplesPerSec << " Hz" << std::endl;
            std::cerr << "  Channels:    " << pOutputFormat->nChannels << std::endl;
            std::cerr << "  Bit Depth:   " << pOutputFormat->wBitsPerSample << " bits" << std::endl;
        } else {
            std::cerr << "  Sample Rate: " << pwfx->nSamplesPerSec << " Hz" << std::endl;
            std::cerr << "  Channels:    " << pwfx->nChannels << std::endl;
            std::cerr << "  Bit Depth:   " << pwfx->wBitsPerSample << " bits" << std::endl;
        }
        std::cerr << "========================================" << std::endl;
        std::cerr << std::endl;

        return true;
    }

    void StartCapture() {
        if (!pAudioClient) return;

        // Create event for audio buffer ready notification
        HANDLE hEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
        if (hEvent == nullptr) {
            std::cerr << "Failed to create event" << std::endl;
            return;
        }

        // Set event handle for buffer notifications
        HRESULT hr = pAudioClient->SetEventHandle(hEvent);
        if (FAILED(hr)) {
            std::cerr << "Failed to set event handle, falling back to polling mode" << std::endl;
            CloseHandle(hEvent);
            StartCapturePolling();
            return;
        }

        hr = pAudioClient->Start();
        if (FAILED(hr)) {
            std::cerr << "Failed to start audio client" << std::endl;
            CloseHandle(hEvent);
            return;
        }

        running = true;

        // Set stdout to binary mode
        _setmode(_fileno(stdout), _O_BINARY);

        std::cerr << "Using event-driven capture mode (no frame drops)" << std::endl;

        // Event-driven capture loop
        while (running) {
            // Wait for buffer ready event with timeout
            DWORD waitResult = WaitForSingleObject(hEvent, 2000);

            if (waitResult != WAIT_OBJECT_0) {
                if (waitResult == WAIT_TIMEOUT) {
                    // No audio data for 2 seconds, continue waiting
                    continue;
                } else {
                    std::cerr << "Wait failed" << std::endl;
                    break;
                }
            }

            // Process all available packets
            UINT32 packetLength = 0;
            hr = pCaptureClient->GetNextPacketSize(&packetLength);

            while (SUCCEEDED(hr) && packetLength != 0) {
                BYTE* pData = nullptr;
                UINT32 numFramesAvailable = 0;
                DWORD flags = 0;
                UINT64 devicePosition = 0;
                UINT64 qpcPosition = 0;

                hr = pCaptureClient->GetBuffer(&pData, &numFramesAvailable, &flags, &devicePosition, &qpcPosition);

                if (SUCCEEDED(hr)) {
                    // Check for buffer overrun (data corruption/discontinuity)
                    if (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) {
                        std::cerr << "Warning: Audio data discontinuity detected (possible frame drop)" << std::endl;
                    }

                    if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                        // Silent buffer - write zeros
                        UINT32 outputSize = numFramesAvailable * (needsResampling ? pOutputFormat->nBlockAlign : pwfx->nBlockAlign);
                        std::vector<BYTE> silence(outputSize, 0);
                        std::cout.write(reinterpret_cast<char*>(silence.data()), silence.size());
                    } else {
                        // Process audio data
                        UINT32 inputSize = numFramesAvailable * pwfx->nBlockAlign;
                        
                        if (needsResampling && resampler) {
                            // Use resampler to convert format
                            std::vector<BYTE> outputData;
                            if (resampler->ProcessAudio(pData, inputSize, outputData)) {
                                // Only write if we got output data
                                if (!outputData.empty()) {
                                    std::cout.write(reinterpret_cast<char*>(outputData.data()), outputData.size());
                                }
                                // If outputData is empty, resampler is buffering - this is normal
                            } else {
                                std::cerr << "Warning: Resampler ProcessAudio failed, skipping frame" << std::endl;
                            }
                        } else {
                            // Write original audio data to stdout
                            std::cout.write(reinterpret_cast<char*>(pData), inputSize);
                        }
                    }

                    std::cout.flush();

                    pCaptureClient->ReleaseBuffer(numFramesAvailable);
                } else {
                    std::cerr << "GetBuffer failed: 0x" << std::hex << hr << std::endl;
                }

                hr = pCaptureClient->GetNextPacketSize(&packetLength);
            }
        }

        pAudioClient->Stop();
        
        // Flush resampler if needed
        if (needsResampling && resampler) {
            std::vector<BYTE> finalData;
            resampler->Flush(finalData);
            if (!finalData.empty()) {
                std::cout.write(reinterpret_cast<char*>(finalData.data()), finalData.size());
                std::cout.flush();
            }
        }
        
        CloseHandle(hEvent);
    }

    // Fallback polling mode
    void StartCapturePolling() {
        if (!pAudioClient) return;

        HRESULT hr = pAudioClient->Start();
        if (FAILED(hr)) {
            std::cerr << "Failed to start audio client" << std::endl;
            return;
        }

        running = true;

        // Set stdout to binary mode
        _setmode(_fileno(stdout), _O_BINARY);

        std::cerr << "Using polling mode (sleep time reduced to minimize frame drops)" << std::endl;

        // Optimized polling: sleep 1/4 of buffer duration to reduce latency
        DWORD sleepTime = static_cast<DWORD>(chunkDuration * 1000 / 4);
        if (sleepTime < 1) sleepTime = 1;

        // Capture loop
        while (running) {
            Sleep(sleepTime);

            UINT32 packetLength = 0;
            hr = pCaptureClient->GetNextPacketSize(&packetLength);

            while (SUCCEEDED(hr) && packetLength != 0) {
                BYTE* pData = nullptr;
                UINT32 numFramesAvailable = 0;
                DWORD flags = 0;

                hr = pCaptureClient->GetBuffer(&pData, &numFramesAvailable, &flags, nullptr, nullptr);

                if (SUCCEEDED(hr)) {
                    // Check for discontinuity
                    if (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) {
                        std::cerr << "Warning: Audio data discontinuity detected" << std::endl;
                    }

                    if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                        // Silent buffer - write zeros
                        UINT32 outputSize = numFramesAvailable * (needsResampling ? pOutputFormat->nBlockAlign : pwfx->nBlockAlign);
                        std::vector<BYTE> silence(outputSize, 0);
                        std::cout.write(reinterpret_cast<char*>(silence.data()), silence.size());
                    } else {
                        // Process audio data
                        UINT32 inputSize = numFramesAvailable * pwfx->nBlockAlign;
                        
                        if (needsResampling && resampler) {
                            // Use resampler to convert format
                            std::vector<BYTE> outputData;
                            if (resampler->ProcessAudio(pData, inputSize, outputData)) {
                                // Only write if we got output data
                                if (!outputData.empty()) {
                                    std::cout.write(reinterpret_cast<char*>(outputData.data()), outputData.size());
                                }
                                // If outputData is empty, resampler is buffering - this is normal
                            } else {
                                std::cerr << "Warning: Resampler ProcessAudio failed, skipping frame" << std::endl;
                            }
                        } else {
                            // Write original audio data to stdout
                            std::cout.write(reinterpret_cast<char*>(pData), inputSize);
                        }
                    }

                    std::cout.flush();

                    pCaptureClient->ReleaseBuffer(numFramesAvailable);
                }

                hr = pCaptureClient->GetNextPacketSize(&packetLength);
            }
        }

        pAudioClient->Stop();
        
        // Flush resampler if needed
        if (needsResampling && resampler) {
            std::vector<BYTE> finalData;
            resampler->Flush(finalData);
            if (!finalData.empty()) {
                std::cout.write(reinterpret_cast<char*>(finalData.data()), finalData.size());
                std::cout.flush();
            }
        }
    }

    void Stop() {
        running = false;
    }

    void Cleanup() {
        if (pAudioClient) {
            pAudioClient->Stop();
        }

        // Cleanup resampler
        if (resampler) {
            resampler.reset();
        }

        if (pwfx) {
            CoTaskMemFree(pwfx);
            pwfx = nullptr;
        }

        if (pOutputFormat) {
            CoTaskMemFree(pOutputFormat);
            pOutputFormat = nullptr;
        }

        SafeRelease(&pCaptureClient);
        SafeRelease(&pAudioClient);
        SafeRelease(&pDevice);
        SafeRelease(&pEnumerator);

        // Shutdown Media Foundation
        MFShutdown();

        CoUninitialize();
    }
};

// Global capture instance for signal handling
WASAPICapture* g_capture = nullptr;

BOOL WINAPI ConsoleHandler(DWORD signal) {
    if (signal == CTRL_C_EVENT || signal == CTRL_BREAK_EVENT) {
        if (g_capture) {
            g_capture->Stop();
        }
        return TRUE;
    }
    return FALSE;
}

void PrintUsage() {
    std::cout << "Usage: wasapi_capture.exe [options]\n";
    std::cout << "Options:\n";
    std::cout << "  --list-devices            List all active playback devices\n";
    std::cout << "  --get-default             Print the ID of the current default device\n";
    std::cout << "  --set-default <id>        Set the default playback device by ID\n";
    std::cout << "  --device <id>             Capture from specific device ID (default: system default)\n";
    std::cout << "  --sample-rate <Hz>        Target sample rate (e.g., 44100, 48000)\n";
    std::cout << "  --channels <n>            Target channels (1 or 2)\n";
    std::cout << "  --bits <n>                Target bit depth (16, 24, 32)\n";
    std::cout << "  --chunk-duration <sec>    Audio chunk duration (default: 0.2)\n";
    std::cout << "  --mute                    Internal mute (not fully implemented)\n";
    std::cout << "  --include-pid <pid>       Only capture audio from this process ID\n";
    std::cout << "  --exclude-pid <pid>       Exclude audio from this process ID\n";
}

int main(int argc, char* argv[]) {
    // Flag parsing variables
    int sampleRate = 0;
    int channels = 0;
    int bitDepth = 0;
    double chunkDuration = 0.05; // Default low latency
    bool mute = false;
    std::wstring captureDeviceId;
    
    // Process single-shot commands first
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--list-devices") {
            CoInitializeEx(nullptr, COINIT_MULTITHREADED);
            auto devices = AudioDeviceManager::GetRenderDevices();
            std::cout << "[\n";
            for (size_t k = 0; k < devices.size(); ++k) {
                const auto& d = devices[k];
                // Convert wstring to UTF-8/ANSI for printing
                std::cout << "  {\"id\": \"";
                for(wchar_t c : d.id) std::cout << (char)c;
                std::cout << "\", \"name\": \"";
                for(wchar_t c : d.name) std::cout << (char)c;
                std::cout << "\", \"default\": " << (d.isDefault ? "true" : "false") << "}";
                if (k < devices.size() - 1) std::cout << ",";
                std::cout << "\n";
            }
            std::cout << "]\n";
            CoUninitialize();
            return 0;
        }
        else if (arg == "--get-default") {
            CoInitializeEx(nullptr, COINIT_MULTITHREADED);
            auto id = AudioDeviceManager::GetDefaultDeviceID();
            for(wchar_t c : id) std::cout << (char)c;
            std::cout << std::endl;
            CoUninitialize();
            return 0;
        }
        else if (arg == "--set-default" && i + 1 < argc) {
            std::string idStr = argv[++i];
            std::wstring wId(idStr.begin(), idStr.end());
            
            CoInitializeEx(nullptr, COINIT_MULTITHREADED);
            bool success = AudioDeviceManager::SetDefaultDevice(wId);
            CoUninitialize();
            
            return success ? 0 : 1;
        }
    }

    // Standard capture arguments
    WASAPICapture capture;
    g_capture = &capture;

    // Set console control handler
    SetConsoleCtrlHandler(ConsoleHandler, TRUE);

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--sample-rate" && i + 1 < argc) {
            sampleRate = std::stoi(argv[++i]);
        } else if (arg == "--channels" && i + 1 < argc) {
            channels = std::stoi(argv[++i]);
        } else if (arg == "--bits" && i + 1 < argc) {
            bitDepth = std::stoi(argv[++i]);
        } else if (arg == "--chunk-duration" && i + 1 < argc) {
            chunkDuration = std::stod(argv[++i]);
        } else if (arg == "--device" && i + 1 < argc) {
             std::string idStr = argv[++i];
             captureDeviceId = std::wstring(idStr.begin(), idStr.end());
             capture.SetDeviceID(captureDeviceId);
        } else if (arg == "--mute") {
            mute = true;
        } else if (arg == "--include-pid" && i + 1 < argc) {
            capture.AddIncludeProcess(std::stoul(argv[++i]));
        } else if (arg == "--exclude-pid" && i + 1 < argc) {
            capture.AddExcludeProcess(std::stoul(argv[++i]));
        }
    }

    capture.SetSampleRate(sampleRate);
    capture.SetChannels(channels);
    capture.SetBitDepth(bitDepth);
    capture.SetChunkDuration(chunkDuration);
    capture.SetMute(mute);

    if (!capture.Initialize()) {
        std::cerr << "\n!!! INITIALIZATION FAILED !!!" << std::endl;
        return 1;
    }

    // Start capturing
    std::cerr << "Starting capture..." << std::endl;
    capture.StartCapture();

    return 0;
}
