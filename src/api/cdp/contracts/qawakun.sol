// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

contract Qawakun is ERC721Enumerable, Ownable, Initializable, UUPSUpgradeable {
    struct QawakunData {
        uint256 id;
        uint256 creationDate;
        string userInfo; // JSON encriptado
        address representedAddress;
        string imageUrl; // URL de la imagen
    }

    mapping(uint256 => QawakunData) public qawakuns;
    uint256 public nextId;

    constructor() ERC721("Qawakun", "QWK") Ownable(msg.sender) {}

    function initialize() public initializer {
        nextId = 1;
    }

    function mint(string memory _userInfo, string memory _imageUrl) public onlyOwner {
        uint256 currentId = nextId;
        qawakuns[currentId] = QawakunData({
            id: currentId,
            creationDate: block.timestamp,
            userInfo: _userInfo,
            representedAddress: owner(),
            imageUrl: _imageUrl
        });
        _mint(msg.sender, currentId);
        nextId++;
    }

    function updateRepresentedAddress(uint256 _id, address _newAddress) public onlyOwner {
        require(ownerOf(_id) != address(0), "Qawakun does not exist");
        qawakuns[_id].representedAddress = _newAddress;
    }

    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        require(ownerOf(_tokenId) != address(0), "Token does not exist");
        QawakunData memory qawakun = qawakuns[_tokenId];
        string memory json = string(abi.encodePacked(
            '{',
                '"name": "Qawakun #', uint2str(qawakun.id), '",',
                '"description": "Un NFT Qawakun",',
                '"image": "', qawakun.imageUrl, '"',
            '}'
        ));
        return json;
    }

    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) return "0";
        uint256 j = _i; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory bstr = new bytes(len); uint256 k = len;
        while (_i != 0) { bstr[--k] = bytes1(uint8(48 + _i % 10)); _i /= 10; }
        return string(bstr);
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
